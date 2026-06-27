import { NextRequest, NextResponse } from 'next/server';
import { getUser } from '@/lib/auth';
import { walletAddressSchema } from '@/lib/positions/queryParams';
import { withRequestLogging } from '@/lib/api/handler';
import { computeLiquidations, generateMockPositions } from '@/lib/positions/liquidation';

async function handleLiquidations(request?: NextRequest) {
  const user = await getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const walletParam = request?.nextUrl?.searchParams.get('wallet') ?? null;

  if (walletParam !== null) {
    const parsed = walletAddressSchema.safeParse(walletParam);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid wallet address', details: parsed.error.issues[0]?.message },
        { status: 400 },
      );
    }
  }

  const walletAddress = walletParam || user.walletAddress || 'GA-mock-address';

  const positions = generateMockPositions(walletAddress);
  const computed = computeLiquidations(positions);
  const totalRiskScore = computed.length > 0
    ? Math.max(...computed.map((p) => p.riskScore))
    : 0;

  return NextResponse.json({
    positions: computed,
    totalRiskScore,
    timestamp: new Date().toISOString(),
  });
}

export const GET = withRequestLogging('/api/liquidations', handleLiquidations);
