import { NextResponse } from 'next/server';
import { AiReplanRequestSchema } from '@/schemas/aiSchemas';
import { routeInterruptionReplanGeneration } from '@/core/ai/modelRouter';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const rawBody = await request.json();
    const parsed = AiReplanRequestSchema.safeParse(rawBody);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'Invalid replan request payload.',
          issues: parsed.error.issues.map((i) => i.message)
        },
        { status: 400 }
      );
    }

    const result = await routeInterruptionReplanGeneration(parsed.data);
    return NextResponse.json(result, { status: 200 });
  } catch {
    return NextResponse.json(
      {
        error: 'Unable to process interruption replan request.'
      },
      { status: 500 }
    );
  }
}