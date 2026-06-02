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

    const response = NextResponse.json({ success: true, walletAddress });
    
    const cookieName = process.env.NEXT_PUBLIC_SESSION_COOKIE || 'session';
    const sessionExpiryHours = parseInt(process.env.AUTH_SESSION_EXPIRY || '24', 10);
    
    response.cookies.set(cookieName, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: sessionExpiryHours * 60 * 60,
    });

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