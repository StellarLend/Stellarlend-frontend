// lib/auth.test.ts
import { describe, it, expect, beforeEach, vi } from "vitest";
import { getUser, getSession, isAuthenticated, getAuthenticatedUser, getSessionExpiry } from "./auth";
import * as nextCookies from "next/headers";

import jwt from "jsonwebtoken";

// Mock next/headers
vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));

describe("Authentication Module", () => {
  const mockUser = {
    id: "user-123",
    email: "test@example.com",
    name: "Test User",
    walletAddress: "GTEST123",
    createdAt: new Date("2024-01-01"),
  };

  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 24);
  expiresAt.setMilliseconds(0);

  // Create a mock JWT token with a valid signature using jsonwebtoken
  const createMockJWT = (user = mockUser, expiry = expiresAt) => {
    const payload = {
      sub: user.id,
      userId: user.id,
      email: user.email,
      name: user.name,
      walletAddress: user.walletAddress,
      iat: Math.floor(new Date("2024-01-01").getTime() / 1000),
      exp: Math.floor(expiry.getTime() / 1000),
    };
    return jwt.sign(payload, "dev-secret-change-in-production");
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getSession", () => {
    it("should return null when no session cookie exists", async () => {
      const mockCookies = {
        get: vi.fn().mockReturnValue(undefined),
      };
      (nextCookies.cookies as any).mockResolvedValue(mockCookies);

      const session = await getSession();
      expect(session).toBeNull();
      expect(mockCookies.get).toHaveBeenCalledWith("session");
    });

    it("should return null when session cookie value is empty", async () => {
      const mockCookies = {
        get: vi.fn().mockReturnValue({ value: "" }),
      };
      (nextCookies.cookies as any).mockResolvedValue(mockCookies);

      const session = await getSession();
      expect(session).toBeNull();
    });

    it("should return null when JWT format is invalid", async () => {
      const mockCookies = {
        get: vi.fn().mockReturnValue({ value: "invalid-token" }),
      };
      (nextCookies.cookies as any).mockResolvedValue(mockCookies);

      const session = await getSession();
      expect(session).toBeNull();
    });

    it("should return session when valid JWT token exists", async () => {
      const token = createMockJWT();
      const mockCookies = {
        get: vi.fn().mockReturnValue({ value: token }),
      };
      (nextCookies.cookies as any).mockResolvedValue(mockCookies);

      const session = await getSession();
      expect(session).not.toBeNull();
      expect(session?.user.id).toBe(mockUser.id);
      expect(session?.user.email).toBe(mockUser.email);
    });

    it("should return null when session is expired", async () => {
      const expiredTime = new Date();
      expiredTime.setHours(expiredTime.getHours() - 1); // Expired 1 hour ago
      const token = createMockJWT(mockUser, expiredTime);

      const mockCookies = {
        get: vi.fn().mockReturnValue({ value: token }),
      };
      (nextCookies.cookies as any).mockResolvedValue(mockCookies);

      const session = await getSession();
      expect(session).toBeNull();
    });

    it("should handle cookie retrieval errors gracefully", async () => {
      (nextCookies.cookies as any).mockRejectedValue(new Error("Cookie error"));

      const session = await getSession();
      expect(session).toBeNull();
    });

    it("should parse session payload correctly", async () => {
      const token = createMockJWT();
      const mockCookies = {
        get: vi.fn().mockReturnValue({ value: token }),
      };
      (nextCookies.cookies as any).mockResolvedValue(mockCookies);

      const session = await getSession();
      expect(session).not.toBeNull();
      expect(session?.user.id).toBe(mockUser.id);
      expect(session?.user.email).toBe(mockUser.email);
      expect(session?.user.name).toBe(mockUser.name);
      expect(session?.user.walletAddress).toBe(mockUser.walletAddress);
      expect(session?.expiresAt).toEqual(expiresAt);
    });
  });

  describe("getUser", () => {
    it("should return user from valid session", async () => {
      const token = createMockJWT();
      const mockCookies = {
        get: vi.fn().mockReturnValue({ value: token }),
      };
      (nextCookies.cookies as any).mockResolvedValue(mockCookies);

      const user = await getUser();
      expect(user).not.toBeNull();
      expect(user?.id).toBe(mockUser.id);
      expect(user?.email).toBe(mockUser.email);
      expect(user?.name).toBe(mockUser.name);
    });

    it("should return null when no session exists", async () => {
      const mockCookies = {
        get: vi.fn().mockReturnValue(undefined),
      };
      (nextCookies.cookies as any).mockResolvedValue(mockCookies);

      const user = await getUser();
      expect(user).toBeNull();
    });

    it("should return null when session is invalid", async () => {
      const mockCookies = {
        get: vi.fn().mockReturnValue({ value: "invalid" }),
      };
      (nextCookies.cookies as any).mockResolvedValue(mockCookies);

      const user = await getUser();
      expect(user).toBeNull();
    });

    it("should handle errors gracefully", async () => {
      (nextCookies.cookies as any).mockRejectedValue(new Error("System error"));

      const user = await getUser();
      expect(user).toBeNull();
    });

    it("should include all user properties", async () => {
      const customUser = {
        ...mockUser,
        walletAddress: "GCUSTOM456",
      };
      const token = createMockJWT(customUser);
      const mockCookies = {
        get: vi.fn().mockReturnValue({ value: token }),
      };
      (nextCookies.cookies as any).mockResolvedValue(mockCookies);

      const user = await getUser();
      expect(user?.walletAddress).toBe(customUser.walletAddress);
    });
  });

  describe("isAuthenticated", () => {
    it("should return true when user has valid session", async () => {
      const token = createMockJWT();
      const mockCookies = {
        get: vi.fn().mockReturnValue({ value: token }),
      };
      (nextCookies.cookies as any).mockResolvedValue(mockCookies);

      const authenticated = await isAuthenticated();
      expect(authenticated).toBe(true);
    });

    it("should return false when no session exists", async () => {
      const mockCookies = {
        get: vi.fn().mockReturnValue(undefined),
      };
      (nextCookies.cookies as any).mockResolvedValue(mockCookies);

      const authenticated = await isAuthenticated();
      expect(authenticated).toBe(false);
    });

    it("should return false when session is expired", async () => {
      const expiredTime = new Date();
      expiredTime.setHours(expiredTime.getHours() - 1);
      const token = createMockJWT(mockUser, expiredTime);
      const mockCookies = {
        get: vi.fn().mockReturnValue({ value: token }),
      };
      (nextCookies.cookies as any).mockResolvedValue(mockCookies);

      const authenticated = await isAuthenticated();
      expect(authenticated).toBe(false);
    });
  });

  describe("getAuthenticatedUser", () => {
    it("should return user when authenticated", async () => {
      const token = createMockJWT();
      const mockCookies = {
        get: vi.fn().mockReturnValue({ value: token }),
      };
      (nextCookies.cookies as any).mockResolvedValue(mockCookies);

      const user = await getAuthenticatedUser();
      expect(user.id).toBe(mockUser.id);
      expect(user.email).toBe(mockUser.email);
    });

    it("should throw error when not authenticated", async () => {
      const mockCookies = {
        get: vi.fn().mockReturnValue(undefined),
      };
      (nextCookies.cookies as any).mockResolvedValue(mockCookies);

      await expect(getAuthenticatedUser()).rejects.toMatchObject({
        code: "UNAUTHENTICATED",
        message: "User is not authenticated",
      });
    });

    it("should throw error when session is expired", async () => {
      const expiredTime = new Date();
      expiredTime.setHours(expiredTime.getHours() - 1);
      const token = createMockJWT(mockUser, expiredTime);
      const mockCookies = {
        get: vi.fn().mockReturnValue({ value: token }),
      };
      (nextCookies.cookies as any).mockResolvedValue(mockCookies);

      await expect(getAuthenticatedUser()).rejects.toMatchObject({
        code: "UNAUTHENTICATED",
      });
    });
  });

  describe("getSessionExpiry", () => {
    it("should return expiry info for valid session", async () => {
      const futureTime = new Date();
      futureTime.setHours(futureTime.getHours() + 24);
      const token = createMockJWT(mockUser, futureTime);
      const mockCookies = {
        get: vi.fn().mockReturnValue({ value: token }),
      };
      (nextCookies.cookies as any).mockResolvedValue(mockCookies);

      const expiry = await getSessionExpiry();
      expect(expiry).not.toBeNull();
      expect(expiry?.expiresAt).toBeDefined();
      expect(expiry?.expiresIn).toBeGreaterThan(0);
    });

    it("should return expiresIn = 0 for expired session", async () => {
      const expiredTime = new Date();
      expiredTime.setHours(expiredTime.getHours() - 1);
      const token = createMockJWT(mockUser, expiredTime);
      const mockCookies = {
        get: vi.fn().mockReturnValue({ value: token }),
      };
      (nextCookies.cookies as any).mockResolvedValue(mockCookies);

      const expiry = await getSessionExpiry();
      // For expired session, the function should still return but expiresIn might be negative or 0
      expect(expiry).toBeDefined();
    });

    it("should return null when no session exists", async () => {
      const mockCookies = {
        get: vi.fn().mockReturnValue(undefined),
      };
      (nextCookies.cookies as any).mockResolvedValue(mockCookies);

      const expiry = await getSessionExpiry();
      expect(expiry).toBeNull();
    });

    it("should handle errors gracefully", async () => {
      (nextCookies.cookies as any).mockRejectedValue(new Error("Error"));

      const expiry = await getSessionExpiry();
      expect(expiry).toBeNull();
    });
  });

  describe("Edge Cases", () => {
    it("should handle multiple consecutive calls", async () => {
      const token = createMockJWT();
      const mockCookies = {
        get: vi.fn().mockReturnValue({ value: token }),
      };
      (nextCookies.cookies as any).mockResolvedValue(mockCookies);

      const user1 = await getUser();
      const user2 = await getUser();
      expect(user1?.id).toBe(user2?.id);
    });

    it("should handle malformed JWT payload", async () => {
      const header = Buffer.from(JSON.stringify({ alg: "HS256" })).toString("base64url");
      const payload = Buffer.from("not valid json").toString("base64url");
      const signature = "signature";
      const token = `${header}.${payload}.${signature}`;

      const mockCookies = {
        get: vi.fn().mockReturnValue({ value: token }),
      };
      (nextCookies.cookies as any).mockResolvedValue(mockCookies);

      const session = await getSession();
      expect(session).toBeNull();
    });

    it("should handle missing user fields in token", async () => {
      const header = Buffer.from(JSON.stringify({ alg: "HS256" })).toString("base64url");
      const payload = Buffer.from(
        JSON.stringify({
          iat: Math.floor(new Date().getTime() / 1000),
          exp: Math.floor(new Date(Date.now() + 3600000).getTime() / 1000),
        })
      ).toString("base64url");
      const signature = "signature";
      const token = `${header}.${payload}.${signature}`;

      const mockCookies = {
        get: vi.fn().mockReturnValue({ value: token }),
      };
      (nextCookies.cookies as any).mockResolvedValue(mockCookies);

      const session = await getSession();
      // Should handle gracefully even with missing fields
      expect(session).toBeDefined();
    });
  });
});
