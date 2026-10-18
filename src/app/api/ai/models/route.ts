import { NextResponse } from 'next/server';
import { getDiscoveredModelCatalogue } from '@/core/ai/modelRouter';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const forceRefresh = searchParams.get('refresh') === 'true';

    const snapshot = await getDiscoveredModelCatalogue(forceRefresh);
    return NextResponse.json(snapshot, { status: 200 });
  } catch {
    return NextResponse.json(
      {
        error: 'Failed to inspect model catalogue.'
      },
      { status: 500 }
    );
  }
}