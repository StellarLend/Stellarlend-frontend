import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { Session, User } from "@/types/common";

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
export async function getSessionExpiry(): Promise<{ expiresAt: Date; expiresIn: number } | null> {
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
 * Decodes and retrieves authenticated user from a Request object.
 * Used for legacy routes like account profile API.
 */
export function getAuthUser(req: NextRequest): { id: string; email: string } | null {
  try {
    let token = "";
    
    // Check Authorization header
    const authHeader = req.headers.get("Authorization");
    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.substring(7);
    } else {
      // Check session cookie
      const sessionCookie = req.cookies.get(AUTH_CONFIG.sessionCookieName);
      if (sessionCookie?.value) {
        token = sessionCookie.value;
      }
    }

    if (!token) return null;

    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf-8'));
    
    // Check expiration
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) return null;
    
    const sub = payload.sub || payload.userId;
    const email = payload.email;
    if (!sub || !email) return null;

    return { id: sub, email };
  } catch {
    return null;
  }
}

/**
 * Enforces authentication on a Request object.
 * Throws a 401 NextResponse if unauthorized.
 */
export function requireAuth(req: NextRequest): { id: string; email: string } {
  const user = getAuthUser(req);
  if (!user) {
    throw NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return user;
}

/**
 * Generates a mock signed token (useful for testing legacy routes)
 */
export function signToken(user: { id: string; email: string }, expiresIn = "1h"): string {
  let expSeconds = 3600;
  if (expiresIn.startsWith("-")) {
    expSeconds = -parseInt(expiresIn.substring(1), 10);
  } else if (expiresIn.endsWith("s")) {
    expSeconds = parseInt(expiresIn, 10);
  } else if (expiresIn.endsWith("h")) {
    expSeconds = parseInt(expiresIn, 10) * 3600;
  }
  
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    sub: user.id,
    userId: user.id,
    email: user.email,
    iat: now,
    exp: now + expSeconds,
  };
  
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const payloadEncoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = Buffer.from("mock-signature").toString("base64url");
  return `${header}.${payloadEncoded}.${signature}`;
}