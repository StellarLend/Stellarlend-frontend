import { createHmac, timingSafeEqual } from "crypto";

/**
 * Default tolerance for timestamp validation (5 minutes in milliseconds).
 */
export const DEFAULT_TOLERANCE_MS = 5 * 60 * 1000;
const SIGNATURE_PREFIX = "sha256=";
const SHA256_HEX_LENGTH = 64;
const SHA256_BYTE_LENGTH = 32;

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
  signature: string | null | undefined,
  secret: string,
): boolean {
  if (!secret || typeof payload !== "string") {
    return false;
  }

  const expectedHex = createHmac("sha256", secret)
    .update(payload)
    .digest("hex");
  const expected = Buffer.from(expectedHex, "hex");

  const receivedHex =
    signature?.startsWith(SIGNATURE_PREFIX) === true
      ? signature.slice(SIGNATURE_PREFIX.length)
      : "";
  const hasValidFormat = /^[0-9a-f]{64}$/i.test(receivedHex);
  const received = hasValidFormat
    ? Buffer.from(receivedHex, "hex")
    : Buffer.alloc(SHA256_BYTE_LENGTH);

  // Always compare equal-length buffers so malformed, missing, and wrong-length
  // signatures take the same verification path before returning false.
  const isSameLength =
    receivedHex.length === SHA256_HEX_LENGTH &&
    received.length === expected.length;
  const signaturesMatch = timingSafeEqual(received, expected);
  return hasValidFormat && isSameLength && signaturesMatch;
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
