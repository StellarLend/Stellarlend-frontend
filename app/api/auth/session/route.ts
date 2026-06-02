// app/api/auth/session/route.ts
// Example API endpoint for session management
// This shows how to set session cookies after user authentication

import { NextResponse, NextRequest } from "next/server";
import { isAccountId } from '@/lib/validation/stellar';
import { withIdempotency } from "@/lib/api/idempotency";
import { withCsrfProtection } from "@/lib/api/handler";
import { generateCsrfToken, setCsrfCookie } from "@/lib/security/csrf";

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
 * This endpoint would return session info from the server-side getSession()
 */
export async function GET(request: NextRequest) {
  try {
    // This is a simple example - in production, import and use getSession()
    // import { getSession } from "@/lib/auth";
    // const session = await getSession();

    const cookieName = process.env.NEXT_PUBLIC_SESSION_COOKIE || "session";
    const sessionCookie = request.cookies.get(cookieName);

    if (!sessionCookie?.value) {
      return NextResponse.json(
        { error: "No active session" },
        { status: 401 }
      );
    }

    return NextResponse.json({
      session: {
        active: true,
        cookie: cookieName,
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
