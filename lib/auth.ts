import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";

export async function getUser() {
  return { name: "Guest" }; // dummy user - expand as needed
}


export interface AuthUser {
  id: string;
  email: string;
}

const JWT_SECRET = process.env.JWT_SECRET ?? "dev-secret-change-in-production";

export function getAuthUser(req: NextRequest): AuthUser | null {
  try {

    const authHeader = req.headers.get("authorization") ?? "";
    const bearerToken = authHeader.startsWith("Bearer ")
        ? authHeader.slice(7)
        : null;


    const cookieToken = req.cookies.get("session")?.value ?? null;

    const token = bearerToken ?? cookieToken;
    if (!token) return null;

    const payload = jwt.verify(token, JWT_SECRET) as jwt.JwtPayload;
    if (typeof payload.sub !== "string" || typeof payload.email !== "string") {
      return null;
    }

    return { id: payload.sub, email: payload.email };
  } catch {
    return null;
  }
}

export function requireAuth(req: NextRequest): AuthUser {
  const user = getAuthUser(req);
  if (!user) {
    throw NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return user;
}


export function signToken(user: AuthUser, expiresIn = "1h"): string {
  return jwt.sign({ sub: user.id, email: user.email }, JWT_SECRET, {
    expiresIn,
  });
}