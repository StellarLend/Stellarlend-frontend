import { NextResponse } from 'next/server';
import { verifyWalletSignature } from '@/lib/auth/wallet';
import { createSession, setSessionCookie } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { transaction } = body;

    if (!transaction) {
      return NextResponse.json({ error: 'transaction is required' }, { status: 400 });
    }

    const walletAddress = await verifyWalletSignature(transaction);

    // Create session for user
    // Since it's a wallet-centric app, we use the wallet address as the user ID
    const token = await createSession({
      id: walletAddress,
      walletAddress: walletAddress,
    });

    await setSessionCookie(token);

    return NextResponse.json({ success: true, walletAddress });
  } catch (error: any) {
    console.error('Verification error:', error);
    return NextResponse.json({ error: error.message || 'Verification failed' }, { status: 401 });
  }
}
