import { createHmac, timingSafeEqual } from "crypto";

/**
 * Default tolerance for timestamp validation (5 minutes in milliseconds).
 */
export const DEFAULT_TOLERANCE_MS = 5 * 60 * 1000;

// ---------------------------------------------------------------------------
// Signature verification
// ---------------------------------------------------------------------------

/**
 * Verify an HMAC-SHA256 webhook signature.
 *
 * The expected header format is `sha256=<hex-digest>`.
 * Uses `timingSafeEqual` to prevent timing-based side-channel attacks.
 *
 * @param payload  - The raw request body string that was signed.
 * @param signature - The signature from the `x-webhook-signature` header.
 * @param secret   - The shared HMAC secret (from `WEBHOOK_SECRET` env var).
 * @returns `true` when the signature is valid.
 */
export function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string,
): boolean {
  if (!signature || !secret || !payload) {
    return false;
  }

  const prefix = "sha256=";
  if (!signature.startsWith(prefix)) {
    return false;
  }

  const receivedHex = signature.slice(prefix.length);
  const expectedHex = createHmac("sha256", secret)
    .update(payload)
    .digest("hex");

  // Constant-time comparison: pad shorter buffer with zeros to match length
  const receivedBuf = Buffer.from(receivedHex, "hex");
  const expectedBuf = Buffer.from(expectedHex, "hex");

  // Create buffers of equal length by padding the shorter one
  const maxLength = Math.max(receivedBuf.length, expectedBuf.length);
  const receivedPadded = Buffer.alloc(maxLength);
  const expectedPadded = Buffer.alloc(maxLength);

  receivedBuf.copy(receivedPadded);
  expectedBuf.copy(expectedPadded);

  return timingSafeEqual(receivedPadded, expectedPadded);
}

/**
 * Compute the HMAC-SHA256 signature for a payload.
 * Returns the full header value: `sha256=<hex-digest>`.
 *
 * Useful in tests and for upstream services generating signatures.
 */
export function signPayload(payload: string, secret: string): string {
  const hex = createHmac("sha256", secret).update(payload).digest("hex");
  return `sha256=${hex}`;
}

// ---------------------------------------------------------------------------
// Timestamp validation
// ---------------------------------------------------------------------------

/**
 * Check that a timestamp (ms since epoch) is within the tolerance window
 * centred on `Date.now()`.
 *
 * @param timestamp    - The event timestamp in milliseconds.
 * @param toleranceMs  - Maximum allowed drift in either direction (default 5 min).
 * @returns `true` when the timestamp is within the tolerance.
 */
export function validateTimestamp(
  timestamp: number,
  toleranceMs: number = DEFAULT_TOLERANCE_MS,
): boolean {
  if (typeof timestamp !== "number" || !Number.isFinite(timestamp)) {
    return false;
  }
  const drift = Math.abs(Date.now() - timestamp);
  return drift <= toleranceMs;
}

// ---------------------------------------------------------------------------
// Nonce store (replay protection)
// ---------------------------------------------------------------------------

interface NonceEntry {
  nonce: string;
  timestamp: number;
}

/**
 * In-memory nonce store that tracks recently-seen event nonces to prevent
 * replay attacks. Old entries are automatically pruned when new ones are added.
 */
export class NonceStore {
  private readonly entries: NonceEntry[] = [];
  private readonly seen: Set<string> = new Set();
  private readonly toleranceMs: number;

  constructor(toleranceMs: number = DEFAULT_TOLERANCE_MS) {
    this.toleranceMs = toleranceMs;
  }

  /** Returns `true` if the nonce has already been processed. */
  has(nonce: string): boolean {
    this.prune();
    return this.seen.has(nonce);
  }

  /** Record a nonce as processed. */
  add(nonce: string, timestamp: number): void {
    this.prune();
    if (!this.seen.has(nonce)) {
      this.seen.add(nonce);
      this.entries.push({ nonce, timestamp });
    }
  }

  /** Number of nonces currently tracked. */
  get size(): number {
    this.prune();
    return this.seen.size;
  }

  /** Remove entries older than the tolerance window. */
  private prune(): void {
    const cutoff = Date.now() - this.toleranceMs;
    while (this.entries.length > 0 && this.entries[0].timestamp < cutoff) {
      const entry = this.entries.shift()!;
      this.seen.delete(entry.nonce);
    }
  }
}
