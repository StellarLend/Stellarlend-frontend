/**
 * app/api/auth/refresh/route.ts
 *
 * POST /api/auth/refresh
 *
 * Re-issues the caller's session JWT with a fresh expiry window so the
 * session-expiry modal can offer a "Stay signed in" action without forcing
 * a full sign-out / sign-in cycle.
 *
 * Requires an active session (via httpOnly session cookie) and a valid CSRF
 * token (handled by `withCsrfProtection`).
 *
 * Behaviour:
 *  - Reads the current session via `getSession()`.
 *  - Returns 401 if no session is present.
 *  - Signs a new JWT containing the same user identity (sub, email, name,
 *    walletAddress) with a freshly minted `iat` and `exp` so the cookie
 *    `maxAge` and the returned `expiresAt` stay in lockstep with
 *    `lib/auth.ts`.
 *  - Re-sets the session cookie with the new token.
 *  - Returns the new session info including `expiresAt` so the client can
 *    re-arm its warning timer without a follow-up GET.
 */

import { NextRequest, NextResponse } from "next/server";
import { withCsrfProtection } from "@/lib/api/handler";
import {
  getAuthCookieConfig,
  getSession,
  createSession,
} from "@/lib/auth";
import { logger } from "@/lib/logger";

export interface RefreshSessionResponse {
  success: true;
  message: string;
  session: {
    active: true;
    cookie: string;
    user: {
      id: string;
      email?: string;
      name?: string;
      walletAddress?: string;
    };
    issuedAt: string;
    expiresAt: string;
  };
}

export interface RefreshSessionErrorResponse {
  error: string;
}

const refreshHandler = async (
  _request: NextRequest,
): Promise<NextResponse<RefreshSessionResponse | RefreshSessionErrorResponse>> => {
  const startedAt = Date.now();
  const route = "/api/auth/refresh";

  try {
    const session = await getSession();

    if (!session) {
      logger.warn("Refresh attempt without active session", route, {
        durationMs: Date.now() - startedAt,
      });
      return NextResponse.json(
        { error: "No active session" },
        { status: 401 },
      );
    }

    const cfg = getAuthCookieConfig();
    const expiresInSeconds = cfg.sessionExpirySeconds;
    const now = Date.now();
    const expiresAt = new Date(now + expiresInSeconds * 1000);

    // Re-issue the JWT with a fresh iat and exp via the shared helper so
    // the cookie maxAge and the response expiresAt agree with lib/auth.ts.
    const token = await createSession({
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
      walletAddress: session.user.walletAddress,
    });

    const response = NextResponse.json<RefreshSessionResponse>(
      {
        success: true,
        message: "Session refreshed",
        session: {
          active: true,
          cookie: cfg.sessionCookieName,
          user: {
            id: session.user.id,
            email: session.user.email,
            name: session.user.name,
            walletAddress: session.user.walletAddress,
          },
          issuedAt: new Date(now).toISOString(),
          expiresAt: expiresAt.toISOString(),
        },
      },
      { status: 200 },
    );

    response.cookies.set(cfg.sessionCookieName, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: expiresInSeconds,
    });

    logger.info("Session refreshed", route, {
      userId: session.user.id,
      durationMs: Date.now() - startedAt,
    });

    return response;
  } catch (error) {
    const durationMs = Date.now() - startedAt;
    logger.error("Session refresh failed", route, {
      durationMs,
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      { error: "Failed to refresh session" },
      { status: 500 },
    );
  }
};

export const POST = withCsrfProtection(refreshHandler);
