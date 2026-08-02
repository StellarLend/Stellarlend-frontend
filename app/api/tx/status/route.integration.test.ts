/**
 * Integration test: `TX_STATUS_ENDPOINT` ↔ `GET /api/tx/status/[hash]`.
 *
 * `TX_STATUS_ENDPOINT` in `lib/tx/constants.ts` is the single source of truth
 * for the polling URL used by `useTxStatus` (lib/tx/useTxStatus.ts). It must
 * resolve to the live Next.js route handler at `app/api/tx/status/[hash]` —
 * and the URL's trailing segment must reach the handler as the dynamic-segment
 * param (e.g. `hash`), or polling silently breaks at runtime with a 400/404.
 *
 * This test pins that contract by:
 *   1. asserting the exact URL template the constant emits;
 *   2. discovering the live route handler from the filesystem (there must be
 *      exactly one dynamic-segment folder under `app/api/tx/status/`);
 *   3. driving that handler with a request URL built by the constant and a
 *      params object keyed by the *discovered* segment name, then asserting a
 *      real status payload comes back and the hash made it through to the RPC
 *      layer.
 *
 * Because everything except the constant's own output is derived from the
 * filesystem, a rename of either the constant's template (e.g.
 * `/api/tx/status/${hash}` → `/api/tx/${hash}`) or the route's folder name
 * (`[hash]` → `[id]`, a common naming drift) fails this test immediately,
 * while a consistent rename (folder + handler + params key) stays green.
 */
/// <reference types="vite/client" />

import { afterEach, describe, expect, it, vi } from 'vitest';
import { TX_STATUS_ENDPOINT } from '@/lib/tx/constants';

vi.mock('@/lib/config', () => ({
  default: {
    stellar: { sorobanRpcUrl: 'https://soroban-testnet.stellar.org' },
  },
}));

// The endpoint template is the source of truth; build the URL once and reuse
// it everywhere below so the test can never drift from the constant.
const URL = TX_STATUS_ENDPOINT('abc123');
const HASH_FROM_URL = URL.slice(URL.lastIndexOf('/') + 1);

// Statically discover every route handler directly under the endpoint's
// directory. There must be exactly one dynamic-segment folder.
const statusRoutes = import.meta.glob('./*/route.ts');

function expectSingleStatusRoute(): string {
  const keys = Object.keys(statusRoutes);
  expect(keys, 'expected exactly one route handler under app/api/tx/status/').toHaveLength(1);
  return keys[0]!;
}

describe('TX_STATUS_ENDPOINT ↔ GET /api/tx/status/[hash]', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("TX_STATUS_ENDPOINT('abc123') emits exactly the live route's URL", () => {
    expect(URL).toBe('/api/tx/status/abc123');
  });

  it('resolves the constant-built URL to the live route and returns a real status payload', async () => {
    const routeKey = expectSingleStatusRoute(); // e.g. './[hash]/route.ts'
    const segmentMatch = routeKey.match(/\[([^\]]+)\]/);
    expect(segmentMatch).not.toBeNull();
    const segmentName = segmentMatch![1]!; // the dynamic-segment name on disk

    const routeLoader = statusRoutes[routeKey] as () => Promise<{
      GET: (
        req: Request,
        ctx: { params: Promise<Record<string, string>> },
      ) => Promise<Response>;
    }>;
    const { GET } = await routeLoader();

    // Stub the upstream Soroban RPC so we exercise the handler's real
    // request/response plumbing without a network call.
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ result: { status: 'success', hash: HASH_FROM_URL } }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );
    vi.stubGlobal('fetch', mockFetch);

    const response = await GET(new Request(`http://localhost${URL}`), {
      params: Promise.resolve({ [segmentName]: HASH_FROM_URL }),
    });

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.status).toBe('SUCCESS');
    expect(payload.cached).toBe(false);
    expect(payload.raw).toMatchObject({ status: 'success', hash: HASH_FROM_URL });

    // The hash extracted from the constant-built URL reached the RPC layer,
    // proving URL → route param → upstream plumbing is intact.
    const rpcCall = mockFetch.mock.calls[0];
    expect(rpcCall).toBeDefined();
    const rpcBody = JSON.parse((rpcCall[1] as RequestInit).body as string);
    expect(rpcBody.method).toBe('getTransaction');
    expect(rpcBody.params).toEqual([HASH_FROM_URL]);
  });
});
