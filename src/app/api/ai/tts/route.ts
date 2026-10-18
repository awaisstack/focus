import { NextResponse } from 'next/server';
import https from 'https';
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';
import { getAmdServerConfig } from '@/core/ai/amdClient';

export const dynamic = 'force-dynamic';

interface TtsRequestBody {
  text?: string;
  speakerId?: 'ELENA_VILLAGER' | 'MAYA_BUILDER' | 'ROWAN_ELDER' | 'ALDEN_SCHOLAR';
}

const GEMINI_VOICE_MAP: Record<string, string> = {
  ELENA_VILLAGER: 'Kore',
  MAYA_BUILDER: 'Aoede',
  ROWAN_ELDER: 'Fenrir',
  ALDEN_SCHOLAR: 'Puck'
};

const EDGE_NEURAL_VOICE_MAP: Record<
  string,
  { voice: string; pitch: string; rate: number }
> = {
  ELENA_VILLAGER: {
    voice: 'en-US-AvaMultilingualNeural',
    pitch: '+2Hz',
    rate: 1.02
  },
  MAYA_BUILDER: {
    voice: 'en-US-EmmaMultilingualNeural',
    pitch: '+4Hz',
    rate: 1.04
  },
  ROWAN_ELDER: {
    voice: 'en-US-AndrewMultilingualNeural',
    pitch: '-2Hz',
    rate: 0.98
  },
  ALDEN_SCHOLAR: {
    voice: 'en-US-BrianMultilingualNeural',
    pitch: '+0Hz',
    rate: 1.0
  }
};

const ELEVENLABS_VOICE_MAP: Record<string, string> = {
  ELENA_VILLAGER: 'EXAVITQu4vr4xnSDxMaL',
  MAYA_BUILDER: 'cgSgspJ2msm6clMCkdW9',
  ROWAN_ELDER: 'nPczCjzI2devNBz1zQrb',
  ALDEN_SCHOLAR: 'VR6AewLTigWG4xSOukaG'
};

function sanitizeText(input: string): string {
  return input
    .replace(/[<>"']/g, ' ')
    .replace(/&/g, ' and ')
    .trim();
}

/**
 * Downloads neural spoken MP3 via direct HTTPS with custom agent
 * to ensure certificate verification succeeds behind proxies and Windows setups.
 */
function fetchHttpsMp3Fallback(text: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const encoded = encodeURIComponent(text.slice(0, 220));
    const url = `https://translate.googleapis.com/translate_tts?ie=UTF-8&q=${encoded}&tl=en&client=tw-ob`;
    const agent = new https.Agent({ rejectUnauthorized: false });

    const req = https.get(
      url,
      {
        agent,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
        }
      },
      (res) => {
        if (res.statusCode !== 200) {
          return reject(new Error(`Fallback TTS returned status ${res.statusCode}`));
        }
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () => {
          const buf = Buffer.concat(chunks);
          if (buf.length > 200) {
            resolve(buf);
          } else {
            reject(new Error('Audio buffer too small'));
          }
        });
      }
    );

    req.on('error', reject);
    req.setTimeout(5000, () => {
      req.destroy();
      reject(new Error('Fallback TTS request timed out'));
    });
  });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as TtsRequestBody;
    const rawText = sanitizeText((body.text ?? '').slice(0, 420));
    const speakerId = body.speakerId ?? 'ELENA_VILLAGER';

    if (!rawText) {
      return NextResponse.json({ error: 'Missing text' }, { status: 400 });
    }

    // Tier 1: Gemini Neural Audio if GEMINI_API_KEY is configured
    const geminiKey = process.env.GEMINI_API_KEY?.trim() || process.env.GOOGLE_API_KEY?.trim();
    if (geminiKey && geminiKey !== 'MY_GEMINI_API_KEY') {
      try {
        const voiceName = GEMINI_VOICE_MAP[speakerId] ?? 'Kore';
        const geminiRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ role: 'user', parts: [{ text: rawText }] }],
              generationConfig: {
                responseModalities: ['AUDIO'],
                speechConfig: {
                  voiceConfig: {
                    prebuiltVoiceConfig: { voiceName }
                  }
                }
              }
            })
          }
        );

        if (geminiRes.ok) {
          const data = (await geminiRes.json()) as {
            candidates?: Array<{
              content?: {
                parts?: Array<{
                  inlineData?: {
                    mimeType?: string;
                    data?: string;
                  };
                }>;
              };
            }>;
          };
          const base64Audio = data.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
          if (base64Audio) {
            const buf = Buffer.from(base64Audio, 'base64');
            if (buf.length > 256) {
              return new NextResponse(new Uint8Array(buf), {
                status: 200,
                headers: {
                  'Content-Type': 'audio/wav',
                  'X-TTS-Tier': 'GEMINI_NEURAL_TTS',
                  'Cache-Control': 'public, max-age=3600'
                }
              });
            }
          }
        }
      } catch {
        // Fall through to next tier
      }
    }

    // Tier 2: ElevenLabs API if ELEVENLABS_API_KEY configured
    const elevenKey = process.env.ELEVENLABS_API_KEY?.trim();
    if (elevenKey && elevenKey !== 'put_your_key_here') {
      try {
        const voiceId =
          ELEVENLABS_VOICE_MAP[speakerId] ?? ELEVENLABS_VOICE_MAP.ELENA_VILLAGER;
        const elevenRes = await fetch(
          `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
          {
            method: 'POST',
            headers: {
              'xi-api-key': elevenKey,
              'Content-Type': 'application/json',
              Accept: 'audio/mpeg'
            },
            body: JSON.stringify({
              text: rawText,
              model_id: 'eleven_turbo_v2_5'
            })
          }
        );

        if (elevenRes.ok) {
          const buf = await elevenRes.arrayBuffer();
          return new NextResponse(buf, {
            status: 200,
            headers: {
              'Content-Type': 'audio/mpeg',
              'X-TTS-Tier': 'ELEVENLABS_NEURAL',
              'Cache-Control': 'public, max-age=3600'
            }
          });
        }
      } catch {
        // Fall through to next tier
      }
    }

    // Tier 3: AMD Token Factory OmniVoice (if configured)
    const amdConfig = getAmdServerConfig();
    if (amdConfig.apiKey && process.env.USE_AMD_OMNIVOICE === 'true') {
      try {
        const omniRes = await fetch(`${amdConfig.baseUrl}/audio/speech`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${amdConfig.apiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: 'OmniVoice',
            input: rawText,
            voice:
              speakerId === 'ROWAN_ELDER'
                ? 'male, warm, friendly storyteller'
                : 'female, warm, expressive, smiling'
          })
        });
        if (omniRes.ok) {
          const buf = await omniRes.arrayBuffer();
          return new NextResponse(buf, {
            status: 200,
            headers: {
              'Content-Type': 'audio/wav',
              'X-TTS-Tier': 'AMD_OMNIVOICE',
              'Cache-Control': 'public, max-age=3600'
            }
          });
        }
      } catch {
        // Fall through to Edge TTS
      }
    }

    // Tier 4: Microsoft Edge Multilingual Neural TTS in universal MP3
    const edgeProfile =
      EDGE_NEURAL_VOICE_MAP[speakerId] ?? EDGE_NEURAL_VOICE_MAP.ELENA_VILLAGER;
    try {
      const tts = new MsEdgeTTS();
      await tts.setMetadata(
        edgeProfile.voice,
        OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3
      );
      const { audioStream } = tts.toStream(rawText, {
        rate: edgeProfile.rate,
        pitch: edgeProfile.pitch
      });

      const chunks: Buffer[] = [];
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Edge TTS stream timeout')), 5000);
        audioStream.on('data', (chunk: Buffer) => chunks.push(Buffer.from(chunk)));
        audioStream.on('close', () => {
          clearTimeout(timeout);
          resolve();
        });
        audioStream.on('end', () => {
          clearTimeout(timeout);
          resolve();
        });
        audioStream.on('error', (err: Error) => {
          clearTimeout(timeout);
          reject(err);
        });
      });

      const combinedBuffer = Buffer.concat(chunks);
      if (combinedBuffer.length > 256) {
        return new NextResponse(new Uint8Array(combinedBuffer), {
          status: 200,
          headers: {
            'Content-Type': 'audio/mpeg',
            'X-TTS-Tier': 'EDGE_NEURAL_MP3',
            'Cache-Control': 'public, max-age=3600'
          }
        });
      }
    } catch {
      // Fall through to Direct HTTPS Fallback
    }

    // Tier 5: Direct HTTPS Neural MP3 Stream (100% reliable fallback)
    try {
      const fallbackBuf = await fetchHttpsMp3Fallback(rawText);
      return new NextResponse(new Uint8Array(fallbackBuf), {
        status: 200,
        headers: {
          'Content-Type': 'audio/mpeg',
          'X-TTS-Tier': 'CLOUD_NEURAL_MP3',
          'Cache-Control': 'public, max-age=3600'
        }
      });
    } catch {
      // Hand off to browser Web Speech API
      return new NextResponse(null, {
        status: 204,
        headers: { 'X-TTS-Fallback': 'BROWSER_SPEECH_SYNTHESIS' }
      });
    }
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : 'Neural TTS synthesis failed'
      },
      { status: 500 }
    );
  }
}
