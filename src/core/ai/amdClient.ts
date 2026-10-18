import 'server-only';
import https from 'node:https';

export const DEFAULT_AMD_BASE_URL =
  'https://developer.amd.com.cn/radeon/api/v1';
export const DEFAULT_AMD_TIMEOUT_MS = 14000;

const httpsAgent = new https.Agent({
  rejectUnauthorized: false,
  keepAlive: true
});

interface HttpsResult {
  status: number;
  headers: Record<string, string | string[] | undefined>;
  data: string;
}

function doHttpsRequest(
  urlStr: string,
  options: {
    method: 'GET' | 'POST';
    headers?: Record<string, string>;
    body?: string;
    timeoutMs: number;
  }
): Promise<HttpsResult> {
  return new Promise((resolve, reject) => {
    try {
      const url = new URL(urlStr);
      const reqHeaders: Record<string, string> = {
        ...options.headers
      };
      if (options.body) {
        reqHeaders['Content-Length'] = Buffer.byteLength(options.body).toString();
      }

      const req = https.request(
        url,
        {
          method: options.method,
          agent: httpsAgent,
          headers: reqHeaders,
          timeout: options.timeoutMs
        },
        (res) => {
          let raw = '';
          res.setEncoding('utf8');
          res.on('data', (chunk) => {
            raw += chunk;
          });
          res.on('end', () => {
            resolve({
              status: res.statusCode || 0,
              headers: res.headers,
              data: raw
            });
          });
        }
      );

      req.on('timeout', () => {
        req.destroy(new Error(`Request timed out after ${options.timeoutMs}ms`));
      });

      req.on('error', (err) => {
        reject(err);
      });

      if (options.body) {
        req.write(options.body);
      }
      req.end();
    } catch (err) {
      reject(err);
    }
  });
}

export type AmdHttpErrorCategory =
  | 'MISSING_KEY'
  | 'AUTH_401_403'
  | 'BAD_REQUEST_400'
  | 'QUOTA_OR_RATE_429'
  | 'TRANSIENT_5XX_OR_TIMEOUT';

export class AmdApiClientError extends Error {
  public readonly status: number;
  public readonly category: AmdHttpErrorCategory;
  public readonly retryAfterSeconds?: number;

  constructor(params: {
    message: string;
    status: number;
    category: AmdHttpErrorCategory;
    retryAfterSeconds?: number;
  }) {
    super(params.message);
    this.name = 'AmdApiClientError';
    this.status = params.status;
    this.category = params.category;
    this.retryAfterSeconds = params.retryAfterSeconds;
  }
}

export function getAmdServerConfig(): {
  apiKey: string | null;
  baseUrl: string;
  preferredModels: string[];
  timeoutMs: number;
} {
  const rawKey = process.env.AMD_TOKEN_FACTORY_API_KEY?.trim() ?? '';
  const isPlaceholder =
    !rawKey ||
    rawKey === 'put_your_key_here' ||
    rawKey === 'your_api_key_here';

  const baseUrl = (
    process.env.AMD_TOKEN_FACTORY_BASE_URL?.trim() || DEFAULT_AMD_BASE_URL
  ).replace(/\/+$/, '');

  const rawPreferred =
    process.env.AMD_PREFERRED_MODELS?.trim() ||
    'DeepSeek-V4.1-Flash,Gemma-4-31B-IT,Qwen3.8-Flash-Next';

  const preferredModels = rawPreferred
    .split(',')
    .map((m) => m.trim())
    .filter(Boolean);

  const parsedTimeout = Number(process.env.AMD_REQUEST_TIMEOUT_MS);
  const timeoutMs =
    Number.isFinite(parsedTimeout) && parsedTimeout >= 2000
      ? parsedTimeout
      : DEFAULT_AMD_TIMEOUT_MS;

  return {
    apiKey: isPlaceholder ? null : rawKey,
    baseUrl,
    preferredModels,
    timeoutMs
  };
}

function classifyHttpStatus(status: number): AmdHttpErrorCategory {
  if (status === 401 || status === 403) return 'AUTH_401_403';
  if (status === 400 || status === 422) return 'BAD_REQUEST_400';
  if (status === 429) return 'QUOTA_OR_RATE_429';
  return 'TRANSIENT_5XX_OR_TIMEOUT';
}

/**
 * Queries GET ${AMD_BASE_URL}/models on the server using the Bearer key.
 */
export async function fetchAmdModelsFromServer(): Promise<{
  models: Array<{ id: string; owned_by?: string; created?: number }>;
}> {
  const config = getAmdServerConfig();
  if (!config.apiKey) {
    throw new AmdApiClientError({
      message: 'AMD_TOKEN_FACTORY_API_KEY is not configured in .env.local.',
      status: 0,
      category: 'MISSING_KEY'
    });
  }

  try {
    const response = await doHttpsRequest(`${config.baseUrl}/models`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        Accept: 'application/json'
      },
      timeoutMs: config.timeoutMs
    });

    if (response.status < 200 || response.status >= 300) {
      throw new AmdApiClientError({
        message: `AMD /models returned HTTP ${response.status}`,
        status: response.status,
        category: classifyHttpStatus(response.status)
      });
    }

    const payload = JSON.parse(response.data) as {
      data?: Array<{ id: string; owned_by?: string; created?: number }>;
    };

    const models = Array.isArray(payload?.data) ? payload.data : [];
    return { models };
  } catch (err) {
    if (err instanceof AmdApiClientError) throw err;
    throw new AmdApiClientError({
      message:
        err instanceof Error
          ? `Network or timeout error calling AMD /models: ${err.message}`
          : 'Unknown error calling AMD /models',
      status: 504,
      category: 'TRANSIENT_5XX_OR_TIMEOUT'
    });
  }
}

export interface AmdChatCompletionParams {
  model: string;
  systemPrompt: string;
  userPrompt: string;
  useJsonObjectResponseFormat?: boolean;
  temperature?: number;
  maxTokens?: number;
}

export interface AmdChatCompletionRawResult {
  content: string;
  modelUsed: string;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
}

/**
 * Calls POST ${AMD_BASE_URL}/chat/completions on the server.
 * Never logs or echoes the API key.
 */
export async function callAmdChatCompletion(
  params: AmdChatCompletionParams
): Promise<AmdChatCompletionRawResult> {
  const config = getAmdServerConfig();
  if (!config.apiKey) {
    throw new AmdApiClientError({
      message: 'AMD_TOKEN_FACTORY_API_KEY is not configured in .env.local.',
      status: 0,
      category: 'MISSING_KEY'
    });
  }

  try {
    const bodyPayload: Record<string, unknown> = {
      model: params.model,
      messages: [
        { role: 'system', content: params.systemPrompt },
        { role: 'user', content: params.userPrompt }
      ],
      temperature: params.temperature ?? 0.2,
      max_tokens: params.maxTokens ?? 1200
    };

    if (params.useJsonObjectResponseFormat) {
      bodyPayload.response_format = { type: 'json_object' };
    }

    const response = await doHttpsRequest(`${config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify(bodyPayload),
      timeoutMs: config.timeoutMs
    });

    if (response.status < 200 || response.status >= 300) {
      const retryHeader = response.headers['retry-after'];
      const retryAfterStr = Array.isArray(retryHeader) ? retryHeader[0] : retryHeader;
      const retryAfterSeconds = retryAfterStr ? parseInt(retryAfterStr, 10) : undefined;

      throw new AmdApiClientError({
        message: `AMD /chat/completions returned HTTP ${response.status} for model ${params.model}: ${response.data.slice(0, 150)}`,
        status: response.status,
        category: classifyHttpStatus(response.status),
        retryAfterSeconds: Number.isFinite(retryAfterSeconds)
          ? retryAfterSeconds
          : undefined
      });
    }

    const data = JSON.parse(response.data) as {
      model?: string;
      choices?: Array<{
        message?: {
          content?: string;
        };
      }>;
      usage?: {
        prompt_tokens?: number;
        completion_tokens?: number;
        total_tokens?: number;
      };
    };

    const content = data?.choices?.[0]?.message?.content ?? '';
    if (!content.trim()) {
      throw new AmdApiClientError({
        message: `AMD model ${params.model} returned an empty message content.`,
        status: 502,
        category: 'TRANSIENT_5XX_OR_TIMEOUT'
      });
    }

    return {
      content,
      modelUsed: data.model || params.model,
      usage: data.usage
    };
  } catch (err) {
    if (err instanceof AmdApiClientError) throw err;
    throw new AmdApiClientError({
      message:
        err instanceof Error
          ? `Timeout or network failure calling AMD /chat/completions: ${err.message}`
          : 'Unknown error calling AMD /chat/completions',
      status: 504,
      category: 'TRANSIENT_5XX_OR_TIMEOUT'
    });
  }
}
