import { NextResponse } from 'next/server';
import { generateWalletChallenge } from '@/lib/auth/wallet';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { walletAddress } = body;

    if (!walletAddress) {
      return NextResponse.json({ error: 'walletAddress is required' }, { status: 400 });
    }

    const transaction = await generateWalletChallenge(walletAddress);

    return NextResponse.json({ transaction });
  } catch (error: any) {
    console.error('Challenge error:', error);
    return NextResponse.json({ error: error.message || 'Failed to generate challenge' }, { status: 500 });
  }
}
