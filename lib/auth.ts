// lib/auth.ts
import { cookies } from "next/headers";
import { User, Session, AuthError } from "@/types/common";

/**
 * Auth Configuration
 * These should be set via environment variables for production
 */
const AUTH_CONFIG = {
  sessionCookieName: process.env.NEXT_PUBLIC_SESSION_COOKIE || "session",
  sessionSecret: process.env.AUTH_SECRET || "dev-secret-change-in-production",
  sessionExpiryHours: parseInt(process.env.AUTH_SESSION_EXPIRY || "24", 10),
};

/**
 * Verify JWT signature (simplified for demo)
 * In production, use proper JWT libraries like jsonwebtoken or jose
 */
function verifySessionSignature(token: string, secret: string): boolean {
  try {
    // Basic verification - in production use proper JWT verification
    const parts = token.split(".");
    if (parts.length !== 3) return false;

    // For production: use jose or jsonwebtoken library
    // import { jwtVerify } from 'jose';
    // const verified = await jwtVerify(token, new TextEncoder().encode(secret));
    // return !!verified;

    return true; // Placeholder - implement proper verification
  } catch {
    return false;
  }
}

/**
 * Parse session payload from JWT
 * In production, use proper JWT decoding with verification
 */
function parseSessionPayload(token: string): Partial<Session> | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    // Decode the payload (base64url decode)
    const payload = JSON.parse(
      Buffer.from(parts[1], "base64url").toString("utf-8")
    );

    return {
      user: {
        id: payload.sub || payload.userId,
        email: payload.email,
        name: payload.name,
        walletAddress: payload.walletAddress,
        createdAt: new Date(payload.iat * 1000),
      },
      issuedAt: new Date(payload.iat * 1000),
      expiresAt: new Date(payload.exp * 1000),
    };
  } catch {
    return null;
  }
}

/**
 * Get the current session from cookies
 * @returns Session if valid, null otherwise
 */
export async function getSession(): Promise<Session | null> {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get(AUTH_CONFIG.sessionCookieName);

    if (!sessionCookie?.value) {
      return null;
    }

    // Verify signature
    if (!verifySessionSignature(sessionCookie.value, AUTH_CONFIG.sessionSecret)) {
      return null;
    }

    // Parse and validate session
    const session = parseSessionPayload(sessionCookie.value);
    if (!session || !session.user || !session.expiresAt) {
      return null;
    }

    // Check if session is expired
    if (new Date() > session.expiresAt) {
      return null;
    }

    return session as Session;
  } catch (error) {
    console.error("Session retrieval error:", error);
    return null;
  }
}

/**
 * Get the current authenticated user
 * @returns User if authenticated, null otherwise
 */
export async function getUser(): Promise<User | null> {
  try {
    const session = await getSession();
    return session?.user || null;
  } catch (error) {
    console.error("User retrieval error:", error);
    return null;
  }
}

/**
 * Get authenticated user with error handling
 * @returns User or throws AuthError
 */
export async function getAuthenticatedUser(): Promise<User> {
  const user = await getUser();
  if (!user) {
    throw {
      code: "UNAUTHENTICATED",
      message: "User is not authenticated",
    } as AuthError;
  }
  return user;
}

/**
 * Check if user is authenticated (server-side)
 * @returns true if user has valid session
 */
export async function isAuthenticated(): Promise<boolean> {
  const user = await getUser();
  return user !== null;
}

/**
 * Get session expiry info (useful for client-side logic)
 * @returns Expiry info or null
 */
export async function getSessionExpiry(): Promise<{ expiresAt: Date; expiresIn: number } | null> {
  try {
    const session = await getSession();
    if (!session?.expiresAt) return null;

    const now = new Date();
    const expiresIn = Math.max(0, session.expiresAt.getTime() - now.getTime());

    return {
      expiresAt: session.expiresAt,
      expiresIn,
    };
  } catch (error) {
    console.error("Session expiry retrieval error:", error);
    return null;
  }
}

