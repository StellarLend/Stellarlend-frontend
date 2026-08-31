/**
 * __tests__/api/quote/route.test.ts  (#1186)
 *
 * Tests that app/api/quote/route.ts returns the correct HTTP 400 response —
 * including the specific machine-readable `error.code` — for every
 * QuoteErrorCode value that lib/lending/quote.ts can emit:
 *
 *   - INVALID_INPUT
 *   - DIVIDE_BY_ZERO
 *   - NON_FINITE_RESULT
 *
 * Each code is tested end-to-end through the real POST handler so that any
 * future refactoring of the route's error serialisation will be caught here.
 */

import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/quote/route";

// ---------------------------------------------------------------------------
// Selectively mock calculateQuote so we can inject controlled error outcomes
// without relying on fragile floating-point edge cases.
// ---------------------------------------------------------------------------

// Save a reference to the real implementation before mocking
// Using var to avoid TDZ issues with vi.mock hoisting
var realCalculateQuote: typeof import("@/lib/lending/quote")["calculateQuote"];

vi.mock("@/lib/lending/quote", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/lending/quote")>();
  realCalculateQuote = actual.calculateQuote;
  return {
    ...actual,
    calculateQuote: vi.fn(actual.calculateQuote),
  };
});

import { calculateQuote } from "@/lib/lending/quote";
import type { QuoteOutcome, QuoteErrorCode } from "@/lib/lending/quote";

const mockedCalculateQuote = vi.mocked(calculateQuote);

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function makePostRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost:3000/api/quote", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const validPayload = {
  type: "lend",
  data: {
    asset: "XLM",
    amount: 1000,
    interestRate: 10,
    duration: 30,
  },
} as const;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("POST /api/quote — error code surface (#1186)", () => {
  beforeEach(() => {
    mockedCalculateQuote.mockReset();
  });

  // ── Success path (baseline) ──────────────────────────────────────────────

  it("returns 200 with a result when calculateQuote succeeds", async () => {
    mockedCalculateQuote.mockImplementation(realCalculateQuote);

    const req = makePostRequest(validPayload);
    const res = await POST(req);

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.result).toBeDefined();
    expect(json.error).toBeUndefined();
  });

  // ── INVALID_INPUT ─────────────────────────────────────────────────────────

  it("returns 400 with error.code=INVALID_INPUT for an INVALID_INPUT outcome", async () => {
    const errorOutcome: QuoteOutcome = {
      ok: false,
      error: {
        code: "INVALID_INPUT",
        message: "Invalid input for quote calculation.",
      },
    };
    mockedCalculateQuote.mockReturnValue(errorOutcome);

    const req = makePostRequest(validPayload);
    const res = await POST(req);

    expect(res.status).toBe(400);

    const json = await res.json();
    expect(json.error).toBeDefined();
    expect(json.error.code).toBe("INVALID_INPUT" satisfies QuoteErrorCode);
    expect(typeof json.error.message).toBe("string");

    // No result key on an error response.
    expect(json.result).toBeUndefined();
  });

  it("returns INVALID_INPUT via the real implementation for a zero amount", async () => {
    // Let the real function run — amount: 0 triggers INVALID_INPUT.
    mockedCalculateQuote.mockImplementation(realCalculateQuote);

    const req = makePostRequest({
      ...validPayload,
      data: { ...validPayload.data, amount: 0 },
    });
    const res = await POST(req);

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.code).toBe("INVALID_INPUT" satisfies QuoteErrorCode);
  });

  // ── DIVIDE_BY_ZERO ────────────────────────────────────────────────────────

  it("returns 400 with error.code=DIVIDE_BY_ZERO for a DIVIDE_BY_ZERO outcome", async () => {
    const errorOutcome: QuoteOutcome = {
      ok: false,
      error: {
        code: "DIVIDE_BY_ZERO",
        message: "Denominator is zero.",
      },
    };
    mockedCalculateQuote.mockReturnValue(errorOutcome);

    const req = makePostRequest(validPayload);
    const res = await POST(req);

    expect(res.status).toBe(400);

    const json = await res.json();
    expect(json.error.code).toBe("DIVIDE_BY_ZERO" satisfies QuoteErrorCode);
    expect(json.error.message).toBe("Denominator is zero.");
    expect(json.result).toBeUndefined();
  });

  // ── NON_FINITE_RESULT ─────────────────────────────────────────────────────

  it("returns 400 with error.code=NON_FINITE_RESULT for a NON_FINITE_RESULT outcome", async () => {
    const errorOutcome: QuoteOutcome = {
      ok: false,
      error: {
        code: "NON_FINITE_RESULT",
        message: "Non-finite result.",
      },
    };
    mockedCalculateQuote.mockReturnValue(errorOutcome);

    const req = makePostRequest(validPayload);
    const res = await POST(req);

    expect(res.status).toBe(400);

    const json = await res.json();
    expect(json.error.code).toBe("NON_FINITE_RESULT" satisfies QuoteErrorCode);
    expect(json.error.message).toBe("Non-finite result.");
    expect(json.result).toBeUndefined();
  });

  // ── All three codes are distinct ──────────────────────────────────────────

  it("returns a different error.code for each of the three QuoteErrorCode values", async () => {
    const codes: QuoteErrorCode[] = [
      "INVALID_INPUT",
      "DIVIDE_BY_ZERO",
      "NON_FINITE_RESULT",
    ];

    const responses = await Promise.all(
      codes.map(async (code) => {
        mockedCalculateQuote.mockReturnValueOnce({
          ok: false,
          error: { code, message: `test-${code}` },
        });
        const res = await POST(makePostRequest(validPayload));
        const json = await res.json();
        return { status: res.status, code: json.error.code as string };
      }),
    );

    expect(responses.every((r) => r.status === 400)).toBe(true);
    const returnedCodes = responses.map((r) => r.code);
    // All three codes must be present and distinct.
    expect(new Set(returnedCodes).size).toBe(3);
    expect(returnedCodes).toEqual(codes);
  });

  // ── Malformed request body ────────────────────────────────────────────────

  it("returns 400 with INVALID_INPUT for an unparseable body", async () => {
    const req = new NextRequest("http://localhost:3000/api/quote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not-json{{{",
    });
    const res = await POST(req);

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.code).toBe("INVALID_INPUT");
  });

  it("returns 400 with INVALID_INPUT when type is missing", async () => {
    const req = makePostRequest({ data: validPayload.data });
    const res = await POST(req);

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.code).toBe("INVALID_INPUT");
  });
});
