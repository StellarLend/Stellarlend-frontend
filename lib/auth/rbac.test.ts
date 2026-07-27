import { SignJWT } from 'jose';
import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const TEST_SECRET = 'test-secret';

async function createToken(payload: Record<string, unknown>, options?: { expiresIn?: string; secret?: string }) {
  const secret = new TextEncoder().encode(options?.secret ?? TEST_SECRET);

  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(options?.expiresIn ?? '1h')
    .sign(secret);
}

async function loadRbacModule() {
  return import('./rbac');
}

async function expectGuardFailure(
  promise: Promise<unknown>,
  expectedStatus: number,
  expectedError: string,
) {
  let response: Response | undefined;

  try {
    await promise;
  } catch (error) {
    response = error as Response;
  }

  expect(response).toBeInstanceOf(Response);
  expect(response?.status).toBe(expectedStatus);
  await expect(response?.json()).resolves.toEqual({ error: expectedError });
}

describe('RBAC guards', () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.AUTH_SECRET = TEST_SECRET;
    process.env.NEXT_PUBLIC_SESSION_COOKIE = 'session';
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('rejects requests without a session token', async () => {
    const { requireAdmin } = await loadRbacModule();
    const request = new NextRequest('http://localhost/api/admin');

    await expectGuardFailure(requireAdmin(request), 401, 'Unauthorized');
  });

  it('rejects malformed and non-Bearer authorization headers', async () => {
    const { requireAdmin } = await loadRbacModule();
    const malformedRequest = new NextRequest('http://localhost/api/admin', {
      headers: { authorization: 'Token abc.def.ghi' },
    });

    await expectGuardFailure(requireAdmin(malformedRequest), 401, 'Unauthorized');
  });

  it('rejects expired tokens', async () => {
    const { requireAdmin } = await loadRbacModule();
    const expiredToken = await createToken(
      {
        userId: 'user-1',
        role: 'admin',
        walletAddress: 'GABC123',
      },
      { expiresIn: '-1h' },
    );
    const request = new NextRequest('http://localhost/api/admin', {
      headers: { authorization: `Bearer ${expiredToken}` },
    });

    await expectGuardFailure(requireAdmin(request), 401, 'Unauthorized');
  });

  it('rejects tokens signed with the wrong secret or tampered with', async () => {
    const { requireAdmin } = await loadRbacModule();
    const wrongSecretToken = await createToken(
      {
        userId: 'user-2',
        role: 'admin',
        walletAddress: 'GXYZ456',
      },
      { secret: 'different-secret' },
    );
    const tamperedToken = `${wrongSecretToken.slice(0, -1)}x`;

    const wrongSecretRequest = new NextRequest('http://localhost/api/admin', {
      headers: { authorization: `Bearer ${wrongSecretToken}` },
    });
    const tamperedRequest = new NextRequest('http://localhost/api/admin', {
      headers: { authorization: `Bearer ${tamperedToken}` },
    });

    await expectGuardFailure(requireAdmin(wrongSecretRequest), 401, 'Unauthorized');
    await expectGuardFailure(requireAdmin(tamperedRequest), 401, 'Unauthorized');
  });

  it('rejects unknown role strings and treats the role claim as case-sensitive', async () => {
    const { requireAdmin, requireOpsOrAdmin, hasRole, Role } = await loadRbacModule();
    const unknownRoleToken = await createToken({
      userId: 'user-3',
      role: 'superuser',
      walletAddress: 'GUNKNOWN',
    });
    const mixedCaseToken = await createToken({
      userId: 'user-4',
      role: 'Admin',
      walletAddress: 'GADMIN',
    });

    const unknownRoleRequest = new NextRequest('http://localhost/api/admin', {
      headers: { authorization: `Bearer ${unknownRoleToken}` },
    });
    const mixedCaseRequest = new NextRequest('http://localhost/api/admin', {
      headers: { authorization: `Bearer ${mixedCaseToken}` },
    });

    await expectGuardFailure(requireAdmin(unknownRoleRequest), 403, 'Forbidden');
    await expectGuardFailure(requireOpsOrAdmin(unknownRoleRequest), 403, 'Forbidden');
    await expectGuardFailure(requireAdmin(mixedCaseRequest), 403, 'Forbidden');
    await expectGuardFailure(requireOpsOrAdmin(mixedCaseRequest), 403, 'Forbidden');

    expect(hasRole({ role: 'Admin' } as never, Role.Admin)).toBe(false);
    expect(hasRole({ role: Role.Admin } as never, Role.Admin)).toBe(true);
  });

  it('allows admin tokens through requireAdmin and ops tokens through requireOpsOrAdmin', async () => {
    const { requireAdmin, requireOpsOrAdmin, Role } = await loadRbacModule();
    const adminToken = await createToken({
      userId: 'admin-user',
      role: Role.Admin,
      walletAddress: 'GADMIN123',
    });
    const opsToken = await createToken({
      userId: 'ops-user',
      role: Role.Ops,
      walletAddress: 'GOPS123',
    });

    const adminRequest = new NextRequest('http://localhost/api/admin', {
      headers: { authorization: `Bearer ${adminToken}` },
    });
    const opsRequest = new NextRequest('http://localhost/api/admin', {
      headers: { authorization: `Bearer ${opsToken}` },
    });

    await expect(requireAdmin(adminRequest)).resolves.toEqual({
      id: 'admin-user',
      email: undefined,
      name: undefined,
      walletAddress: 'GADMIN123',
      role: Role.Admin,
    });

    await expect(requireOpsOrAdmin(opsRequest)).resolves.toEqual({
      id: 'ops-user',
      email: undefined,
      name: undefined,
      walletAddress: 'GOPS123',
      role: Role.Ops,
    });
  });

  it('rejects admin-only access for ops tokens', async () => {
    const { requireAdmin, Role } = await loadRbacModule();
    const opsToken = await createToken({
      userId: 'ops-user',
      role: Role.Ops,
      walletAddress: 'GOPS123',
    });
    const request = new NextRequest('http://localhost/api/admin', {
      headers: { authorization: `Bearer ${opsToken}` },
    });

    await expectGuardFailure(requireAdmin(request), 403, 'Forbidden');
  });
});
