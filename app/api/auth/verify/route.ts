import { NextRequest, NextResponse } from 'next/server';
import { verifyWalletSignature } from '@/lib/auth/wallet';
import { createSession, setSessionCookie } from '@/lib/auth';
import { appendAuditEvent, hashIp } from '@/lib/audit/logger';

export async function POST(request: NextRequest) {
  const requestId = request.headers.get('x-request-id');
  const ipHash = hashIp(request.headers.get('x-forwarded-for'));

  try {
    const body = await request.json();
    const { transaction } = body;

    if (!transaction) {
      await appendAuditEvent({
        actorWallet: null,
        action: 'auth.verify',
        resource: 'wallet',
        status: 'failure',
        requestId,
        ipHash,
      });

      return NextResponse.json({ error: 'transaction is required' }, { status: 400 });
    }

    const walletAddress = await verifyWalletSignature(transaction);

    const token = await createSession({
      id: walletAddress,
      walletAddress,
    });

    await setSessionCookie(token);

    await appendAuditEvent({
      actorWallet: walletAddress,
      action: 'auth.verify',
      resource: 'wallet',
      status: 'success',
      requestId,
      ipHash,
    });

    return NextResponse.json({ success: true, walletAddress });
  } catch (error: any) {
    await appendAuditEvent({
      actorWallet: null,
      action: 'auth.verify',
      resource: 'wallet',
      status: 'failure',
      requestId,
      ipHash,
    });

    console.error('Verification error:', error);
    return NextResponse.json({ error: error.message || 'Verification failed' }, { status: 401 });
  }
}