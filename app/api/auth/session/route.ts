// app/api/auth/session/route.ts
// Example API endpoint for session management
// This shows how to set session cookies after user authentication

import { NextResponse, NextRequest } from "next/server";
import { isAccountId } from '@/lib/validation/stellar';
import { withIdempotency } from "@/lib/api/idempotency";
import { withCsrfProtection } from "@/lib/api/handler";
import { generateCsrfToken, setCsrfCookie } from "@/lib/security/csrf";

// Fall back to "no claim available" (null) instead of the epoch when the
// JWT payload omitted iat/exp. lib/auth.ts:getSession falls back to
// `new Date(0)` for missing claims; serialising that would falsely imply
// a 50+ year-old session.
function toIsoOrNull(date: Date | undefined | null): string | null {
  if (!date || date.getTime() <= 0) return null;
  return date.toISOString();
}

/**
 * Example payload structure for session creation
 * In production, this would come from your auth provider
 */
interface CreateSessionRequest {
  userId: string;
  email: string;
  name: string;
  walletAddress?: string;
}

/**
 * Example: Create a session (POST /api/auth/session)
 *
 * Usage:
 * const response = await fetch("/api/auth/session", {
 *   method: "POST",
 *   headers: { "Content-Type": "application/json" },
 *   body: JSON.stringify({
 *     userId: "user-123",
 *     email: "user@example.com",
 *     name: "John Doe",
 *     walletAddress: "GXXXXXX"
 *   })
 * });
 */
const postHandler = async (request: NextRequest) => {
  return withIdempotency(request, async (request) => {
    try {
      const body: CreateSessionRequest = await request.json();
// Validate wallet address if provided
if (body.walletAddress && !isAccountId(body.walletAddress)) {
  return NextResponse.json({ error: 'Invalid wallet address' }, { status: 400 });
}

      // Validate required fields
      if (!body.userId || !body.email || !body.name) {
        return NextResponse.json(
          { error: "Missing required fields" },
          { status: 400 }
        );
      }

      // Create JWT payload
      const now = Math.floor(Date.now() / 1000);
      const expiresIn = (parseInt(process.env.AUTH_SESSION_EXPIRY || "24") * 3600); // hours to seconds

      const payload = {
        sub: body.userId,
        userId: body.userId,
        email: body.email,
        name: body.name,
        walletAddress: body.walletAddress,
        iat: now,
        exp: now + expiresIn,
      };

      // In production, create a proper JWT using jose or jsonwebtoken:
      // import { SignJWT } from 'jose';
      // const token = await new SignJWT(payload)
      //   .setProtectedHeader({ alg: "HS256" })
      //   .setIssuedAt()
      //   .setExpirationTime("24h")
      //   .sign(new TextEncoder().encode(process.env.AUTH_SECRET!));

      // For demo purposes, create a mock JWT
      const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString(
        "base64url"
      );
      const payloadEncoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
      const signature = Buffer.from("mock-signature").toString("base64url");
      const token = `${header}.${payloadEncoded}.${signature}`;

      // Create response with session cookie
      const response = NextResponse.json({
        success: true,
        message: "Session created",
        user: {
          id: body.userId,
          email: body.email,
          name: body.name,
        },
      });

      // Set httpOnly cookie (XSS-safe)
      const cookieName = process.env.NEXT_PUBLIC_SESSION_COOKIE || "session";
      response.cookies.set(cookieName, token, {
        httpOnly: true, // Prevent JavaScript access
        secure: process.env.NODE_ENV === "production", // HTTPS only in production
        sameSite: "strict", // CSRF protection
        maxAge: expiresIn, // Cookie expiry in seconds
        path: "/", // Available to all routes
      });

      // Set CSRF cookie
      const csrfToken = generateCsrfToken();
      setCsrfCookie(response, csrfToken);

      return response;
    } catch (error) {
      console.error("Session creation error:", error);
      return NextResponse.json(
        { error: "Failed to create session" },
        { status: 500 }
      );
    }
  });
};

export const POST = withCsrfProtection(postHandler);

/**
 * Example: Get current session (GET /api/auth/session)
 *
 * Returns session info from the server-side getSession().
 * Includes `issuedAt` and `expiresAt` so the client can derive
 * time-to-expiry and drive proactive UI like the session-expiry modal.
 *
 * Shape: `issuedAt` and `expiresAt` are nullable ISO strings. Clients
 * should treat `null` as "unknown" (the JWT payload omitted the claim)
 * rather than missing / 1970-01-01.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { error: "No active session" },
        { status: 401 }
      );
    }

    const cookieName = process.env.NEXT_PUBLIC_SESSION_COOKIE || "session";

    return NextResponse.json({
      session: {
        active: true,
        cookie: cookieName,
        user: session.user,
        issuedAt: toIsoOrNull(session.issuedAt),
        expiresAt: toIsoOrNull(session.expiresAt),
      },
    });
  } catch (error) {
    console.error("Session retrieval error:", error);
    return NextResponse.json(
      { error: "Failed to retrieve session" },
      { status: 500 }
    );
  }
}

/**
 * Example: Clear session (DELETE /api/auth/session)
 *
 * Usage:
 * await fetch("/api/auth/session", { method: "DELETE" });
 */
const deleteHandler = async (request: NextRequest) => {
  return withIdempotency(request, async () => {
    try {
      const response = NextResponse.json({
        success: true,
        message: "Session cleared",
      });

      // Clear the session cookie
      const cookieName = process.env.NEXT_PUBLIC_SESSION_COOKIE || "session";
      response.cookies.delete(cookieName);

      // Clear the CSRF cookie too
      const csrfCookieName = process.env.CSRF_COOKIE_NAME || "csrf-token";
      response.cookies.delete(csrfCookieName);

      return response;
    } catch (error) {
      console.error("Session deletion error:", error);
      return NextResponse.json(
        { error: "Failed to delete session" },
        { status: 500 }
      );
    }
  });
};

export const DELETE = withCsrfProtection(deleteHandler);
