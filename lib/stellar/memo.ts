import { createHmac } from 'crypto';

export type MemoType = 'MEMO_TEXT' | 'MEMO_ID' | 'MEMO_HASH' | 'MEMO_RETURN';

export interface StellarMemo {
  type: MemoType;
  value: string;
}

const MEMO_SALT = process.env.MEMO_SALT || 'stellarlend-default-salt';

// Bidirectional registries
const memoToAccount = new Map<string, string>(); // "type:value" -> accountId
const accountToMemo = new Map<string, StellarMemo>(); // accountId -> StellarMemo

/**
 * Validates whether a given memo value conforms to the Stellar protocol specifications.
 */
export function validateMemo(value: string, type: MemoType): boolean {
  if (!value) return false;

  switch (type) {
    case 'MEMO_TEXT': {
      // Must be a string, maximum 28 bytes in UTF-8
      const byteLength = Buffer.byteLength(value, 'utf8');
      return byteLength <= 28;
    }
    case 'MEMO_ID': {
      // Must be a string containing a 64-bit unsigned integer (0 to 18446744073709551615)
      if (!/^\d+$/.test(value)) return false;
      try {
        const val = BigInt(value);
        const maxUint64 = BigInt('18446744073709551615');
        return val >= 0n && val <= maxUint64;
      } catch {
        return false;
      }
    }
    case 'MEMO_HASH':
    case 'MEMO_RETURN':
      // Must be a 32-byte hex-encoded string (64 characters)
      return /^[0-9a-fA-F]{64}$/.test(value);
    default:
      return false;
  }
}

/**
 * Derives a deterministic MEMO_ID for a given Stellar account public key.
 */
export function deriveMemoId(accountId: string): string {
  const hmac = createHmac('sha256', MEMO_SALT);
  hmac.update(accountId);
  const hash = hmac.digest();
  // Read first 8 bytes as a BigInt uint64
  const val = hash.readBigUInt64BE(0);
  return val.toString();
}

/**
 * Derives a deterministic MEMO_HASH for a given Stellar account public key.
 */
export function deriveMemoHash(accountId: string): string {
  const hmac = createHmac('sha256', MEMO_SALT);
  hmac.update(accountId);
  return hmac.digest('hex');
}

/**
 * Derives a deterministic MEMO_TEXT for a given Stellar account public key.
 */
export function deriveMemoText(accountId: string): string {
  const hmac = createHmac('sha256', MEMO_SALT);
  hmac.update(accountId);
  // Take first 28 characters of the base64-encoded hash
  return hmac.digest('base64').substring(0, 28);
}

/**
 * Explicitly registers a mapping between an account ID and a memo.
 */
export function registerAccountMemo(accountId: string, memo: StellarMemo): void {
  if (!validateMemo(memo.value, memo.type)) {
    throw new Error(`Invalid memo value "${memo.value}" for type "${memo.type}"`);
  }
  const key = `${memo.type}:${memo.value.toLowerCase()}`;
  memoToAccount.set(key, accountId);
  accountToMemo.set(accountId, memo);
}

/**
 * Derives a deterministic memo for an account and automatically registers it.
 */
export function deriveAndRegisterMemo(accountId: string, type: MemoType): StellarMemo {
  let value: string;
  switch (type) {
    case 'MEMO_ID':
      value = deriveMemoId(accountId);
      break;
    case 'MEMO_HASH':
      value = deriveMemoHash(accountId);
      break;
    case 'MEMO_TEXT':
      value = deriveMemoText(accountId);
      break;
    case 'MEMO_RETURN':
      value = deriveMemoHash(accountId);
      break;
    default:
      throw new Error(`Unsupported memo type: ${type}`);
  }

  const memo: StellarMemo = { type, value };
  registerAccountMemo(accountId, memo);
  return memo;
}

/**
 * Resolves a Stellar account ID for a given memo type and value.
 */
export function resolveAccountByMemo(value: string, type: MemoType): string | null {
  const key = `${type}:${value.toLowerCase()}`;
  return memoToAccount.get(key) || null;
}

/**
 * Retrieves the registered memo for a Stellar account.
 */
export function getMemoForAccount(accountId: string): StellarMemo | null {
  return accountToMemo.get(accountId) || null;
}

/**
 * Clears all registered mappings (useful for tests).
 */
export function clearMemoRegistry(): void {
  memoToAccount.clear();
  accountToMemo.clear();
}

/**
 * Configuration helper to check if strict mode is active.
 */
export function isStrictModeEnabled(): boolean {
  return process.env.STRICT_MEMO_MODE === 'true';
}
