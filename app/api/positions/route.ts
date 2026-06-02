import { NextResponse } from 'next/server';
import { getUser } from '../../../lib/auth';
import { withRequestLogging } from '@/lib/api/handler';

async function handlePositions() {
  const user = await getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return NextResponse.json({
    availableBalance: '$3,750.00 XLM',
    copyAddress: 'BaDE1b2U45...670UzZ',
    borrowedAmount: '$1,500.00 XLM',
    nextDue: '$250.00 in 4 days',
    suppliedFunds: '$5,000.00 XLM',
    earnings: '$95.00 XLM',
    healthFactor: 1.5,
  });
}

export const GET = withRequestLogging('/api/positions', handlePositions);
