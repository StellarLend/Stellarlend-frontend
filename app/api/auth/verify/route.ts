import { NextResponse } from 'next/server';
import { verifyWalletSignature } from '@/lib/auth/wallet';
import { createSession } from '@/lib/auth';
import { generateCsrfToken, setCsrfCookie } from '@/lib/security/csrf';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { transaction } = body;

    if (!transaction) {
      return NextResponse.json({ error: 'transaction is required' }, { status: 400 });
    }

    const walletAddress = await verifyWalletSignature(transaction);

    const token = await createSession({
      id: walletAddress,
      walletAddress: walletAddress,
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

    const csrfToken = generateCsrfToken();
    setCsrfCookie(response, csrfToken);

    return response;
  } catch (error: any) {
    console.error('Verification error:', error);
    return NextResponse.json({ error: error.message || 'Verification failed' }, { status: 401 });
  }
}
