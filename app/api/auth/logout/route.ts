/**
 * POST /api/auth/logout
 *
 * Revokes the current session and clears the session cookie.
 * This endpoint ensures that the session token is invalidated server-side
 * even if the cookie is manipulated or replayed from another device.
 *
 * For wallet-based auth flows, this enables disconnect functionality
 * and prevents unauthorized access from intercepted cookies.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { revokeSession } from '@/lib/auth/session-store';
import { logger } from '@/lib/logger';
import { cookies } from 'next/headers';
import { safeRedirectPath } from '@/lib/security/safe-redirect';

const AUTH_CONFIG = {
  sessionCookieName: process.env.NEXT_PUBLIC_SESSION_COOKIE || 'session',
};

export interface LogoutResponse {
  success: boolean;
  message: string;
  walletAddress?: string; // included for navbar UI state management
  redirectTo?: string; // validated safe redirect target, set when returnUrl was provided
}

export interface LogoutErrorResponse {
  error: string;
}

/**
 * Logout endpoint
 * Requires an active session (via session cookie)
 *
 * Response: { success: true, message: "Logged out successfully", walletAddress: "G..." }
 */
export async function POST(request: NextRequest): Promise<NextResponse<LogoutResponse | LogoutErrorResponse>> {
  const startedAt = Date.now();
  const route = '/api/auth/logout';

  try {
    // Get the current session to verify user is authenticated
    const session = await getSession();

    if (!session) {
      logger.warn('Logout attempt without active session', route, {
        durationMs: Date.now() - startedAt,
      });

      return NextResponse.json(
        { error: 'No active session' },
        { status: 401 }
      );
    }

    const walletAddress = session.user.walletAddress;
    const userId = session.user.id;

    // Validate optional returnUrl query parameter for safe redirect after logout
    const rawReturnUrl = request.nextUrl.searchParams.get('returnUrl');
    const redirectTo = rawReturnUrl ? safeRedirectPath(rawReturnUrl) : undefined;
    if (rawReturnUrl && redirectTo === '/') {
      // The value was rejected — only safe default remains. Don't echo it back as
      // a redirect hint since there was nothing actionable.
    }

    // Get the session token from cookies for revocation
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get(AUTH_CONFIG.sessionCookieName);

    if (sessionCookie?.value) {
      // Revoke the session server-side
      const revoked = revokeSession(sessionCookie.value);

      if (!revoked) {
        logger.warn('Failed to revoke session', route, {
          userId,
          walletAddress,
          durationMs: Date.now() - startedAt,
        });
      }
    }

    // Create response with session cleared
    const response = NextResponse.json<LogoutResponse>(
      {
        success: true,
        message: 'Logged out successfully',
        walletAddress, // useful for UI state management in navbar
        ...(redirectTo && redirectTo !== '/' ? { redirectTo } : {}),
      },
      { status: 200 }
    );

    // Clear the session cookie
    response.cookies.delete(AUTH_CONFIG.sessionCookieName);

    // Log successful logout for audit trail
    logger.info('User logged out', route, {
      userId,
      walletAddress,
      durationMs: Date.now() - startedAt,
    });

    return response;
  } catch (error) {
    const durationMs = Date.now() - startedAt;
    const errorMessage = error instanceof Error ? error.message : String(error);

    logger.error('Logout failed', route, {
      error: errorMessage,
      durationMs,
    });

    return NextResponse.json(
      { error: 'Failed to logout' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/auth/logout
 * Alternative logout endpoint (for REST semantics)
 * Also revokes the session and clears the cookie
 */
export async function DELETE(request: NextRequest): Promise<NextResponse<LogoutResponse | LogoutErrorResponse>> {
  // Delegate to POST handler
  return POST(request);
}
