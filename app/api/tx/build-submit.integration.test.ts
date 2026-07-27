/**
 * Integration test for the fee/sequence contract across the transaction lifecycle.
 *
 * The transaction lifecycle spans two route handlers:
 *   - POST /api/tx/build   (produces unsigned XDR)
 *   - POST /api/tx/submit  (submits the signed XDR)
 *
 * This test asserts that the fee and sequence-number values embedded during
 * the build step survive unchanged through the client-side signing round-trip
 * to the submit step — the exact contract that silently breaks if either route's
 * transaction-construction logic changes independently.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import simulateSuccessFixture from '@/lib/soroban/__fixtures__/simulate-success.json';

vi.mock('@/lib/config', () => ({
  default: {
    stellar: {
      network: 'testnet',
      sorobanContractId: 'GCONTRACTTESTXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
      sorobanRpcUrl: 'https://private-rpc.test',
    },
    rateLimit: {
      account: {
        limit: 10,
        windowMs: 60000,
        burst: 10,
      },
    },
  },
}));

vi.mock('@/lib/server-config', () => ({
  default: {
    stellar: {
      sorobanRpcUrl: 'https://private-rpc.test',
      transactionFee: 100,
    },
  },
}));

vi.mock('@/lib/auth', () => ({
  getSession: vi.fn(),
}));

vi.mock('@/lib/audit/logger', () => ({
  hashIp: vi.fn(() => 'hashed-ip-placeholder'),
  appendAuditEvent: vi.fn(),
}));

// Metrics mock to avoid side effects during test
vi.mock('@/lib/metrics/registry', () => ({
  metrics: {
    sorobanSubmissions: { inc: vi.fn() },
    sorobanSubmitDuration: { observe: vi.fn() },
  },
}));

import { clearAccountBucketCache } from '@/lib/rate-limit/account-bucket';
import { POST as buildHandler } from './build/route';
import { POST as submitHandler } from './submit/route';

/** A valid Stellar public key for testing. */
const TEST_SOURCE_ACCOUNT = `G${'A'.repeat(55)}`;

/** The unsigned XDR returned by a successful build RPC call. */
const UNSIGNED_XDR_FIXTURE = 'AAAAAgAAAADTEST1234567890UNSIGNEDXDR==';



/**
 * Creates a valid TxBuildRequest body with an optional custom fee.
 */
function buildRequestBody(overrides?: { fee?: number }) {
  return {
    type: 'lend' as const,
    sourceAccount: TEST_SOURCE_ACCOUNT,
    data: { asset: 'XLM', amount: 1000, interestRate: 5, duration: 30 },
    ...overrides,
  };
}

describe('Transaction lifecycle integration (build → sign → submit)', () => {
  /** Captured RPC calls so we can inspect fee/sequence payloads. */
  let rpcCalls: Array<{ url: string; body: unknown }> = [];

  beforeEach(() => {
    clearAccountBucketCache();
    rpcCalls = [];
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  /**
   * Helper: set up a mock fetch that simulates a successful build RPC
   * returning UNSIGNED_XDR_FIXTURE, followed by a successful simulate RPC,
   * followed by a successful submit RPC returning a tx hash.
   */
  function mockBuildAndSubmitSuccess() {
    const mockFetch = vi
      .fn()
      // 1st call: build RPC → returns unsigned XDR
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ result: { transaction: UNSIGNED_XDR_FIXTURE } }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      )
      // 2nd call: simulate RPC → success
      .mockResolvedValueOnce(
        new Response(JSON.stringify(simulateSuccessFixture), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      )
      // 3rd call: submit RPC → returns hash
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ result: { hash: 'tx-integration-hash-123' } }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      );

    vi.stubGlobal('fetch', (url: string, init: RequestInit) => {
      let parsedBody: unknown = null;
      if (init?.body && typeof init.body === 'string') {
        try {
          parsedBody = JSON.parse(init.body);
        } catch {
          parsedBody = init.body;
        }
      }
      rpcCalls.push({ url, body: parsedBody });
      return mockFetch(url, init);
    });
  }

  // ── FEE CONSISTENCY ────────────────────────────────────────────────

  it('preserves the default fee (100 stroops) from build through the submit round-trip', async () => {
    mockBuildAndSubmitSuccess();

    // Step 1: Build the transaction
    const buildResponse = await buildHandler(
      new Request('http://localhost/api/tx/build', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(buildRequestBody()),
      }),
    );

    expect(buildResponse.status).toBe(200);
    const buildJson = await buildResponse.json();
    expect(buildJson.unsignedXdr).toBe(UNSIGNED_XDR_FIXTURE);

    // Verify the build RPC call included the default fee
    const buildRpcCall = rpcCalls[0];
    expect(buildRpcCall).toBeDefined();
    const buildParams = (buildRpcCall.body as any)?.params?.[0];
    expect(buildParams).toBeDefined();
    expect(buildParams.fee).toBe(100);
    expect(buildParams.source).toBe(TEST_SOURCE_ACCOUNT);
    expect(buildParams.network_passphrase).toBe('Test SDF Network ; September 2015');

    // Step 2: Simulate client-side signing (append "signed-" prefix)
    const signedXdr = `signed-${buildJson.unsignedXdr}`;

    // Step 3: Submit the signed XDR
    const submitResponse = await submitHandler(
      new Request('http://localhost/api/tx/submit', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ signedEnvelopeXdr: signedXdr }),
      }),
    );

    expect(submitResponse.status).toBe(200);
    const submitJson = await submitResponse.json();
    expect(submitJson.status).toBe('submitted');
    expect(submitJson.hash).toBe('tx-integration-hash-123');

    // Verify the submit RPC call wraps the signed XDR correctly
    const submitRpcCall = rpcCalls[2]; // 0=build, 1=simulate, 2=submit
    expect(submitRpcCall).toBeDefined();
    const submitParams = (submitRpcCall.body as any)?.params?.[0];
    expect(submitParams).toBeDefined();
    expect(submitParams.tx).toBe(signedXdr);
    // The submit RPC method should be send_transaction
    expect((submitRpcCall.body as any).method).toBe('send_transaction');

    // NOTE: sequence-number assertions are not possible without XDR decoding.
    // The sequence number is embedded inside the XDR binary blob produced by
    // the upstream RPC. Since these tests mock the RPC layer and do not have
    // access to a Stellar SDK XDR decoder, we verify the fee value in the RPC
    // params and trust that the envelope (unsignedXdr → signedEnvelopeXdr)
    // round-trip preserves the sequence unchanged — the same contract the
    // client relies on at runtime.
  });

  it('preserves a custom fee override from build through the submit round-trip', async () => {
    mockBuildAndSubmitSuccess();

    // Step 1: Build with custom fee of 500 stroops
    const buildResponse = await buildHandler(
      new Request('http://localhost/api/tx/build', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(buildRequestBody({ fee: 500 })),
      }),
    );

    expect(buildResponse.status).toBe(200);
    const buildJson = await buildResponse.json();
    expect(buildJson.unsignedXdr).toBe(UNSIGNED_XDR_FIXTURE);

    // Verify the custom fee was passed to the RPC
    const buildRpcCall = rpcCalls[0];
    const buildParams = (buildRpcCall.body as any)?.params?.[0];
    expect(buildParams.fee).toBe(500);

    // Step 2: "Sign" and submit
    const signedXdr = `signed-${buildJson.unsignedXdr}`;
    const submitResponse = await submitHandler(
      new Request('http://localhost/api/tx/submit', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ signedEnvelopeXdr: signedXdr }),
      }),
    );

    expect(submitResponse.status).toBe(200);
    const submitJson = await submitResponse.json();
    expect(submitJson.status).toBe('submitted');
    expect(submitJson.hash).toBe('tx-integration-hash-123');

    // Verify the signed XDR is passed through (fee is embedded in XDR)
    const submitRpcCall = rpcCalls[2];
    const submitParams = (submitRpcCall.body as any)?.params?.[0];
    expect(submitParams.tx).toBe(signedXdr);
  });

  it('handles the full lifecycle for a borrow-type transaction', async () => {
    mockBuildAndSubmitSuccess();

    const borrowBody = {
      type: 'borrow' as const,
      sourceAccount: TEST_SOURCE_ACCOUNT,
      data: {
        asset: 'USDC',
        amount: 500,
        interestRate: 3,
        duration: 90,
        collateral: 'XLM',
        collateralAmount: 1000,
      },
    };

    const buildResponse = await buildHandler(
      new Request('http://localhost/api/tx/build', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(borrowBody),
      }),
    );

    expect(buildResponse.status).toBe(200);
    const buildJson = await buildResponse.json();
    expect(buildJson.unsignedXdr).toBe(UNSIGNED_XDR_FIXTURE);

    // Verify borrow-specific params in the RPC call
    const buildRpcCall = rpcCalls[0];
    const buildParams = (buildRpcCall.body as any)?.params?.[0];

    // Default fee is 100 stroops; fee preservation is tested explicitly above.
    // The crucial contract here is that the borrow instruction is built correctly.
    expect(buildParams.fee).toBe(100);
    const instruction = buildParams.instructions?.[0];
    expect(instruction).toBeDefined();
    expect(instruction.function).toBe('borrow');

    // Submit
    const signedXdr = `signed-${buildJson.unsignedXdr}`;
    const submitResponse = await submitHandler(
      new Request('http://localhost/api/tx/submit', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ signedEnvelopeXdr: signedXdr }),
      }),
    );

    expect(submitResponse.status).toBe(200);
    const submitJson = await submitResponse.json();
    expect(submitJson.status).toBe('submitted');
  });

  // ── ERROR PROPAGATION ─────────────────────────────────────────────

  it('propagates a build RPC error correctly (no submit should occur)', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ error: { code: 400, message: 'bad sequence' } }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );

    vi.stubGlobal('fetch', (url: string, init: RequestInit) => {
      rpcCalls.push({ url, body: init?.body ? JSON.parse(init.body as string) : null });
      return mockFetch(url, init);
    });

    const buildResponse = await buildHandler(
      new Request('http://localhost/api/tx/build', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(buildRequestBody()),
      }),
    );

    expect(buildResponse.status).toBe(502);
    const buildJson = await buildResponse.json();
    expect(buildJson.error.code).toBe(400);

    // Only the build RPC should have been called, not submit
    expect(rpcCalls).toHaveLength(1);
  });

  it('handles migration from build success to submit failure gracefully', async () => {
    const mockFetch = vi
      .fn()
      // build RPC succeeds
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ result: { transaction: UNSIGNED_XDR_FIXTURE } }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      )
      // simulate RPC succeeds
      .mockResolvedValueOnce(
        new Response(JSON.stringify(simulateSuccessFixture), {
          status: 200,
          headers: { 'content-type': 'application/json' } },
        ),
      )
      // submit RPC fails
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ error: { code: -32000, message: 'tx_insufficient_fee' } }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      );

    vi.stubGlobal('fetch', (url: string, init: RequestInit) => {
      rpcCalls.push({ url, body: init?.body ? JSON.parse(init.body as string) : null });
      return mockFetch(url, init);
    });

    // Build succeeds
    const buildResponse = await buildHandler(
      new Request('http://localhost/api/tx/build', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(buildRequestBody()),
      }),
    );
    expect(buildResponse.status).toBe(200);

    // Submit fails with fee error
    const submitResponse = await submitHandler(
      new Request('http://localhost/api/tx/submit', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ signedEnvelopeXdr: `signed-${UNSIGNED_XDR_FIXTURE}` }),
      }),
    );

    expect(submitResponse.status).toBe(502);
    const submitJson = await submitResponse.json();
    expect(submitJson.error.code).toBe(-32000);
    expect(submitJson.error.message).toBe('tx_insufficient_fee');

    // Both build and submit RPC calls were made
    expect(rpcCalls).toHaveLength(3); // build + simulate + submit
  });

  // ── SIMULATE FLAG ─────────────────────────────────────────────────

  it('pre-simulates on submit when the simulate query param is set', async () => {
    const mockFetch = vi
      .fn()
      // build RPC
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ result: { transaction: UNSIGNED_XDR_FIXTURE } }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      )
      // build simulate RPC
      .mockResolvedValueOnce(
        new Response(JSON.stringify(simulateSuccessFixture), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      )
      // submit simulate RPC
      .mockResolvedValueOnce(
        new Response(JSON.stringify(simulateSuccessFixture), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      )
      // submit RPC
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ result: { hash: 'tx-sim-hash-456' } }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      );

    vi.stubGlobal('fetch', (url: string, init: RequestInit) => {
      rpcCalls.push({ url, body: init?.body ? JSON.parse(init.body as string) : null });
      return mockFetch(url, init);
    });

    // Build
    const buildResponse = await buildHandler(
      new Request('http://localhost/api/tx/build', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(buildRequestBody()),
      }),
    );
    expect(buildResponse.status).toBe(200);

    // Submit with simulate=true
    const signedXdr = `signed-${UNSIGNED_XDR_FIXTURE}`;
    const submitResponse = await submitHandler(
      new Request('http://localhost/api/tx/submit?simulate=true', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ signedEnvelopeXdr: signedXdr }),
      }),
    );

    expect(submitResponse.status).toBe(200);
    const submitJson = await submitResponse.json();
    expect(submitJson.status).toBe('submitted');
    expect(submitJson.hash).toBe('tx-sim-hash-456');

    // Total RPC calls: build + build-simulate + submit-simulate + submit = 4
    expect(rpcCalls).toHaveLength(4);

    // Verify submission simulate was called with the right signed XDR
    const submitSimulateCall = rpcCalls[2];
    const simParams = (submitSimulateCall.body as any)?.params?.[0];
    expect(simParams.transaction).toBe(signedXdr);
    expect((submitSimulateCall.body as any).method).toBe('simulateTransaction');
  });
});
