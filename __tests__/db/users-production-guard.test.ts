/**
 * __tests__/db/users-production-guard.test.ts  (#1188)
 *
 * Verifies that lib/db/users.ts throws loudly when NODE_ENV is 'production'
 * and getUsers is still backed by the hardcoded in-memory USER_STORE seed
 * array — so shipping placeholder data to real admins is a loud failure
 * rather than a silent one.
 */

import { describe, it, expect, vi, afterEach } from "vitest";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Re-import lib/db/users fresh, with NODE_ENV set to the given value.
 * Vitest caches modules by default, so we use `vi.resetModules()` before
 * each dynamic import to get a clean module evaluation.
 */
async function importUsersWithEnv(
  nodeEnv: string,
): Promise<typeof import("@/lib/db/users")> {
  vi.resetModules();
  const originalEnv = process.env.NODE_ENV;
  // NODE_ENV is read-only in some environments; use Object.defineProperty.
  Object.defineProperty(process.env, "NODE_ENV", {
    value: nodeEnv,
    configurable: true,
    writable: true,
  });
  try {
    return await import("@/lib/db/users");
  } finally {
    Object.defineProperty(process.env, "NODE_ENV", {
      value: originalEnv,
      configurable: true,
      writable: true,
    });
  }
}

afterEach(() => {
  vi.resetModules();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("lib/db/users production guard (#1188)", () => {
  it("throws at import time in production when USER_STORE is the seed array", async () => {
    await expect(importUsersWithEnv("production")).rejects.toThrow(
      /USER_STORE/,
    );
  });

  it("error message instructs the developer to replace USER_STORE", async () => {
    let thrownError: Error | null = null;
    try {
      await importUsersWithEnv("production");
    } catch (err) {
      thrownError = err as Error;
    }
    expect(thrownError).not.toBeNull();
    expect(thrownError!.message).toMatch(/replace the user_store implementation/i);
  });

  it("does NOT throw in development even with the seed store", async () => {
    await expect(importUsersWithEnv("development")).resolves.not.toThrow();
  });

  it("does NOT throw in test even with the seed store", async () => {
    await expect(importUsersWithEnv("test")).resolves.not.toThrow();
  });

  it("_isSeedStore returns true when passed the actual USER_STORE reference", async () => {
    const mod = await importUsersWithEnv("test");
    expect(mod._isSeedStore(mod.USER_STORE)).toBe(true);
  });

  it("_isSeedStore returns false when passed a different array", async () => {
    const mod = await importUsersWithEnv("test");
    const differentStore = [...mod.USER_STORE]; // new array, same contents
    expect(mod._isSeedStore(differentStore)).toBe(false);
  });

  it("getUsers still works correctly in non-production environments", async () => {
    const mod = await importUsersWithEnv("test");
    const result = mod.getUsers({ page: 1, pageSize: 10 });

    // Seed data has 3 users.
    expect(result.total).toBe(3);
    expect(result.users.length).toBe(3);
    expect(result.totalPages).toBe(1);
  });

  it("getUsers pagination works correctly with the seed store", async () => {
    const mod = await importUsersWithEnv("test");
    const page1 = mod.getUsers({ page: 1, pageSize: 2 });

    expect(page1.users.length).toBe(2);
    expect(page1.total).toBe(3);
    expect(page1.totalPages).toBe(2);

    const page2 = mod.getUsers({ page: 2, pageSize: 2 });
    expect(page2.users.length).toBe(1);
  });

  it("getUsers search filtering works correctly with the seed store", async () => {
    const mod = await importUsersWithEnv("test");
    const result = mod.getUsers({ page: 1, pageSize: 10, search: "alice" });

    expect(result.users.length).toBe(1);
    expect(result.users[0].email).toBe("alice@stellarlend.io");
  });
});
