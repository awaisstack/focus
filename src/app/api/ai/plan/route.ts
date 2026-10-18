import { NextResponse } from 'next/server';
import { AiPlanRequestSchema } from '@/schemas/aiSchemas';
import { routeGoalPlanGeneration } from '@/core/ai/modelRouter';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const rawBody = await request.json();
    const parsed = AiPlanRequestSchema.safeParse(rawBody);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'Invalid goal plan request payload.',
          issues: parsed.error.issues.map((i) => i.message)
        },
        { status: 400 }
      );
    }

    const result = await routeGoalPlanGeneration(parsed.data);
    return NextResponse.json(result, { status: 200 });
  } catch {
    return NextResponse.json(
      {
        error: 'Unable to process goal plan request.'
      },
      { status: 500 }
    );
  }
}