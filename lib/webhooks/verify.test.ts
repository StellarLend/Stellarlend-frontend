import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  verifyWebhookSignature,
  signPayload,
  validateTimestamp,
  NonceStore,
  DEFAULT_TOLERANCE_MS,
} from "@/lib/webhooks/verify";

// ---------------------------------------------------------------------------
// verifyWebhookSignature
// ---------------------------------------------------------------------------

describe("verifyWebhookSignature", () => {
  const secret = "test-secret-key";
  const payload = '{"event":"transaction.status_updated"}';

  it("returns true for a valid signature", () => {
    const sig = signPayload(payload, secret);
    expect(verifyWebhookSignature(payload, sig, secret)).toBe(true);
  });

  it("returns false when the payload has been tampered with", () => {
    const sig = signPayload(payload, secret);
    expect(verifyWebhookSignature(payload + "x", sig, secret)).toBe(false);
  });

  it("returns false for a signature made with a different secret", () => {
    const sig = signPayload(payload, "wrong-secret");
    expect(verifyWebhookSignature(payload, sig, secret)).toBe(false);
  });

  it("returns false when signature is empty string", () => {
    expect(verifyWebhookSignature(payload, "", secret)).toBe(false);
  });

  it("returns false when secret is empty string", () => {
    const sig = signPayload(payload, secret);
    expect(verifyWebhookSignature(payload, sig, "")).toBe(false);
  });

  it("returns false when payload is empty string", () => {
    const sig = signPayload(payload, secret);
    expect(verifyWebhookSignature("", sig, secret)).toBe(false);
  });

  it("returns false when signature has wrong prefix", () => {
    const sig = signPayload(payload, secret);
    const noPrefix = sig.replace("sha256=", "md5=");
    expect(verifyWebhookSignature(payload, noPrefix, secret)).toBe(false);
  });

  it("returns false when hex digest has wrong length", () => {
    expect(verifyWebhookSignature(payload, "sha256=abcd", secret)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// signPayload
// ---------------------------------------------------------------------------

describe("signPayload", () => {
  it("returns a string starting with sha256=", () => {
    const sig = signPayload("body", "secret");
    expect(sig).toMatch(/^sha256=[0-9a-f]{64}$/);
  });

  it("produces deterministic output for the same inputs", () => {
    const a = signPayload("body", "secret");
    const b = signPayload("body", "secret");
    expect(a).toBe(b);
  });

  it("produces different output for different payloads", () => {
    const a = signPayload("body-a", "secret");
    const b = signPayload("body-b", "secret");
    expect(a).not.toBe(b);
  });
});

// ---------------------------------------------------------------------------
// validateTimestamp
// ---------------------------------------------------------------------------

describe("validateTimestamp", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-06-01T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("accepts a current timestamp", () => {
    expect(validateTimestamp(Date.now())).toBe(true);
  });

  it("accepts a timestamp within tolerance (just inside)", () => {
    expect(validateTimestamp(Date.now() - DEFAULT_TOLERANCE_MS)).toBe(true);
  });

  it("rejects a timestamp just outside tolerance (past)", () => {
    expect(validateTimestamp(Date.now() - DEFAULT_TOLERANCE_MS - 1)).toBe(
      false,
    );
  });

  it("accepts a future timestamp within tolerance", () => {
    expect(validateTimestamp(Date.now() + DEFAULT_TOLERANCE_MS)).toBe(true);
  });

  it("rejects a future timestamp outside tolerance", () => {
    expect(validateTimestamp(Date.now() + DEFAULT_TOLERANCE_MS + 1)).toBe(
      false,
    );
  });

  it("rejects NaN", () => {
    expect(validateTimestamp(NaN)).toBe(false);
  });

  it("rejects Infinity", () => {
    expect(validateTimestamp(Infinity)).toBe(false);
  });

  it("accepts with a custom tolerance", () => {
    const oneSecond = 1000;
    expect(validateTimestamp(Date.now() - 500, oneSecond)).toBe(true);
    expect(validateTimestamp(Date.now() - 1500, oneSecond)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// NonceStore
// ---------------------------------------------------------------------------

describe("NonceStore", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-06-01T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("reports a new nonce as unseen", () => {
    const store = new NonceStore();
    expect(store.has("nonce-1")).toBe(false);
  });

  it("reports an added nonce as seen", () => {
    const store = new NonceStore();
    store.add("nonce-1", Date.now());
    expect(store.has("nonce-1")).toBe(true);
  });

  it("tracks multiple distinct nonces", () => {
    const store = new NonceStore();
    store.add("a", Date.now());
    store.add("b", Date.now());
    expect(store.has("a")).toBe(true);
    expect(store.has("b")).toBe(true);
    expect(store.size).toBe(2);
  });

  it("does not duplicate a nonce when added twice", () => {
    const store = new NonceStore();
    store.add("a", Date.now());
    store.add("a", Date.now());
    expect(store.size).toBe(1);
  });

  it("prunes entries older than the tolerance window", () => {
    const tolerance = 60_000; // 1 minute
    const store = new NonceStore(tolerance);

    store.add("old-nonce", Date.now());

    // Advance time past the tolerance window
    vi.advanceTimersByTime(tolerance + 1);

    expect(store.has("old-nonce")).toBe(false);
    expect(store.size).toBe(0);
  });

  it("keeps entries within the tolerance window", () => {
    const tolerance = 60_000;
    const store = new NonceStore(tolerance);

    store.add("recent-nonce", Date.now());

    // Advance time but stay within the window
    vi.advanceTimersByTime(tolerance - 1000);

    expect(store.has("recent-nonce")).toBe(true);
  });
});
