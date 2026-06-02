import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import jwt from "jsonwebtoken";
import { jwtVerify, SignJWT } from "jose";

export interface AuthUser {
  id: string;
  email: string;
}

/**
 * Auth Configuration
 * These should be set via environment variables for production
 */
const AUTH_CONFIG = {
  sessionCookieName: process.env.NEXT_PUBLIC_SESSION_COOKIE || "session",
  sessionSecret: process.env.AUTH_SECRET || "dev-secret-change-in-production",
  sessionExpiryHours: parseInt(process.env.AUTH_SESSION_EXPIRY || "24", 10),
};

export const JWT_SECRET =
  process.env.JWT_SECRET || AUTH_CONFIG.sessionSecret;

/**
 * Create a new session JWT
 */
export async function createSession(user: Partial<User>): Promise<string> {
  const secret = new TextEncoder().encode(AUTH_CONFIG.sessionSecret);
  const alg = "HS256";

  const token = await new SignJWT({
    userId: user.id,
    walletAddress: user.walletAddress,
    email: user.email,
    name: user.name,
  })
    .setProtectedHeader({ alg })
    .setIssuedAt()
    .setExpirationTime(`${AUTH_CONFIG.sessionExpiryHours}h`)
    .sign(secret);

  return token;
}

/**
 * Set session cookie
 */
export async function setSessionCookie(token: string) {
  const cookieStore = await cookies();
  cookieStore.set({
    name: AUTH_CONFIG.sessionCookieName,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: AUTH_CONFIG.sessionExpiryHours * 60 * 60,
  });
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

    const secret = new TextEncoder().encode(AUTH_CONFIG.sessionSecret);

    // Verify and parse session
    try {
      const { payload } = await jwtVerify(sessionCookie.value, secret);

      return {
        user: {
          id: (payload.sub || payload.userId) as string,
          email: payload.email as string | undefined,
          name: payload.name as string | undefined,
          walletAddress: payload.walletAddress as string | undefined,
          createdAt: new Date((payload.iat || 0) * 1000),
        },
        issuedAt: new Date((payload.iat || 0) * 1000),
        expiresAt: new Date((payload.exp || 0) * 1000),
      } as Session;
    } catch (e) {
      // Invalid signature or expired token
      return null;
    }
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
 * Check if the current user is authenticated
 */
export async function isAuthenticated(): Promise<boolean> {
  const user = await getUser();
  return !!user;
}

/**
 * Get session expiry information
 */
export async function getSessionExpiry(): Promise<{
  expiresAt: Date;
  expiresIn: number;
} | null> {
  const session = await getSession();
  if (!session) return null;

  const now = new Date();
  const expiresIn = Math.max(0, session.expiresAt.getTime() - now.getTime());

  return {
    expiresAt: session.expiresAt,
    expiresIn,
  };
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
    };
  }
  return user;
}

/**
 * Extract JWT token from request (Bearer header or session cookie)
 */
function extractToken(req: NextRequest): string | null {
  const authHeader = req.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice(7);
  }

  const cookieHeader = req.headers.get("cookie") || "";
  const match = cookieHeader.match(
    new RegExp(`(?:^|;)\\s*${AUTH_CONFIG.sessionCookieName}=([^;]*)`)
  );
  if (match) {
    return match[1];
  }

  return null;
}

/**
 * Get authenticated user from a NextRequest (Bearer token or session cookie)
 * Verifies JWT signature.
 */
export function getAuthUser(req: NextRequest): AuthUser | null {
  const token = extractToken(req);
  if (!token) return null;

  try {
    const payload = jwt.verify(token, JWT_SECRET) as {
      sub?: string;
      email?: string;
    };
    if (!payload.sub || !payload.email) return null;
    return { id: payload.sub, email: payload.email };
  } catch {
    return null;
  }
}

/**
 * Enforces authentication on a Request object.
 * Throws a 401 NextResponse if unauthorized.
 */
export function requireAuth(req: NextRequest): AuthUser {
  const user = getAuthUser(req);
  if (!user) {
    throw NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return user;
}

/**
 * Create a signed JWT for testing or internal use.
 */
export function signToken(user: AuthUser, expiresIn = "1h"): string {
  return jwt.sign({ sub: user.id, email: user.email }, JWT_SECRET, {
    expiresIn,
  });
}
