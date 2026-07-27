import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  validateMemo,
  deriveMemoId,
  deriveMemoHash,
  deriveMemoText,
  registerAccountMemo,
  deriveAndRegisterMemo,
  resolveAccountByMemo,
  getMemoForAccount,
  clearMemoRegistry,
  isStrictModeEnabled,
  MemoType,
} from '../memo';

describe('Stellar Memo Module', () => {
  beforeEach(() => {
    clearMemoRegistry();
    vi.stubEnv('STRICT_MEMO_MODE', 'false');
    vi.stubEnv('MEMO_SALT', 'test-salt-value');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('validateMemo', () => {
    it('validates MEMO_TEXT correctly', () => {
      expect(validateMemo('hello', 'MEMO_TEXT')).toBe(true);
      expect(validateMemo('a'.repeat(28), 'MEMO_TEXT')).toBe(true);
      expect(validateMemo('a'.repeat(29), 'MEMO_TEXT')).toBe(false);
      expect(validateMemo('', 'MEMO_TEXT')).toBe(false);
    });

    it('validates MEMO_TEXT utf8 byte size correctly', () => {
      // 10 multi-byte characters like 🚀 (4 bytes each) = 40 bytes (should be false)
      expect(validateMemo('🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀', 'MEMO_TEXT')).toBe(false);
      // 7 multi-byte characters = 28 bytes (should be true)
      expect(validateMemo('🚀🚀🚀🚀🚀🚀🚀', 'MEMO_TEXT')).toBe(true);
    });

    it('validates MEMO_ID correctly within uint64 boundaries', () => {
      expect(validateMemo('0', 'MEMO_ID')).toBe(true);
      expect(validateMemo('123456789', 'MEMO_ID')).toBe(true);
      // Max uint64: 18446744073709551615
      expect(validateMemo('18446744073709551615', 'MEMO_ID')).toBe(true);
      // Max uint64 + 1
      expect(validateMemo('18446744073709551616', 'MEMO_ID')).toBe(false);
      expect(validateMemo('-1', 'MEMO_ID')).toBe(false);
      expect(validateMemo('abc', 'MEMO_ID')).toBe(false);
      expect(validateMemo('', 'MEMO_ID')).toBe(false);
    });

    it('validates MEMO_HASH and MEMO_RETURN correctly', () => {
      const validHash = 'a'.repeat(64);
      const invalidHashShort = 'a'.repeat(63);
      const invalidHashLong = 'a'.repeat(65);
      const invalidHashChars = 'g' + 'a'.repeat(63);

      expect(validateMemo(validHash, 'MEMO_HASH')).toBe(true);
      expect(validateMemo(validHash.toUpperCase(), 'MEMO_HASH')).toBe(true);
      expect(validateMemo(invalidHashShort, 'MEMO_HASH')).toBe(false);
      expect(validateMemo(invalidHashLong, 'MEMO_HASH')).toBe(false);
      expect(validateMemo(invalidHashChars, 'MEMO_HASH')).toBe(false);

      expect(validateMemo(validHash, 'MEMO_RETURN')).toBe(true);
    });

    it('returns false for invalid memo type', () => {
      expect(validateMemo('test', 'INVALID_TYPE' as any)).toBe(false);
    });
  });

  describe('deterministic derivation', () => {
    const account = 'GA2C5RFPE6GCKMY3AA3H6AOF5Q4G5S4GX6TQCGEAAS624JBZ2G2UQHGD';

    it('derives MEMO_ID deterministically', () => {
      const memoId1 = deriveMemoId(account);
      const memoId2 = deriveMemoId(account);
      expect(memoId1).toBe(memoId2);
      expect(/^\d+$/.test(memoId1)).toBe(true);
      expect(validateMemo(memoId1, 'MEMO_ID')).toBe(true);
    });

    it('derives MEMO_HASH deterministically', () => {
      const memoHash1 = deriveMemoHash(account);
      const memoHash2 = deriveMemoHash(account);
      expect(memoHash1).toBe(memoHash2);
      expect(/^[0-9a-f]{64}$/.test(memoHash1)).toBe(true);
      expect(validateMemo(memoHash1, 'MEMO_HASH')).toBe(true);
    });

    it('derives MEMO_TEXT deterministically', () => {
      const memoText1 = deriveMemoText(account);
      const memoText2 = deriveMemoText(account);
      expect(memoText1).toBe(memoText2);
      expect(memoText1.length).toBeLessThanOrEqual(28);
      expect(validateMemo(memoText1, 'MEMO_TEXT')).toBe(true);
    });
  });

  describe('Registry & Resolution', () => {
    const account = 'GA2C5RFPE6GCKMY3AA3H6AOF5Q4G5S4GX6TQCGEAAS624JBZ2G2UQHGD';
    const memo = { type: 'MEMO_TEXT' as MemoType, value: 'my-payment-identifier' };

    it('registers and resolves account memo correctly', () => {
      registerAccountMemo(account, memo);
      expect(resolveAccountByMemo(memo.value, memo.type)).toBe(account);
      expect(resolveAccountByMemo(memo.value.toUpperCase(), memo.type)).toBe(account); // case insensitive
      expect(getMemoForAccount(account)).toEqual(memo);
    });

    it('throws error when registering an invalid memo format', () => {
      const invalidMemo = { type: 'MEMO_TEXT' as MemoType, value: 'a'.repeat(30) };
      expect(() => registerAccountMemo(account, invalidMemo)).toThrow('Invalid memo value');
    });

    it('resolves derived memos after calling deriveAndRegisterMemo', () => {
      const derivedMemo = deriveAndRegisterMemo(account, 'MEMO_ID');
      expect(derivedMemo.type).toBe('MEMO_ID');
      expect(validateMemo(derivedMemo.value, 'MEMO_ID')).toBe(true);

      expect(resolveAccountByMemo(derivedMemo.value, 'MEMO_ID')).toBe(account);
      expect(getMemoForAccount(account)).toEqual(derivedMemo);
    });

    it('supports deriveAndRegisterMemo for HASH and TEXT and RETURN types', () => {
      const hashMemo = deriveAndRegisterMemo(account, 'MEMO_HASH');
      expect(hashMemo.type).toBe('MEMO_HASH');
      expect(resolveAccountByMemo(hashMemo.value, 'MEMO_HASH')).toBe(account);

      const textMemo = deriveAndRegisterMemo(account, 'MEMO_TEXT');
      expect(textMemo.type).toBe('MEMO_TEXT');
      expect(resolveAccountByMemo(textMemo.value, 'MEMO_TEXT')).toBe(account);

      const returnMemo = deriveAndRegisterMemo(account, 'MEMO_RETURN');
      expect(returnMemo.type).toBe('MEMO_RETURN');
      expect(resolveAccountByMemo(returnMemo.value, 'MEMO_RETURN')).toBe(account);
    });

    it('throws error for unsupported derive memo type', () => {
      expect(() => deriveAndRegisterMemo(account, 'INVALID' as any)).toThrow('Unsupported memo type');
    });

    it('returns null for unresolved memo or unregistered account', () => {
      expect(resolveAccountByMemo('non-existent', 'MEMO_TEXT')).toBeNull();
      expect(getMemoForAccount('unregistered-account')).toBeNull();
    });
  });

  describe('isStrictModeEnabled', () => {
    it('returns false by default', () => {
      expect(isStrictModeEnabled()).toBe(false);
    });

    it('returns true when environment variable STRICT_MEMO_MODE is true', () => {
      vi.stubEnv('STRICT_MEMO_MODE', 'true');
      expect(isStrictModeEnabled()).toBe(true);
    });
  });
});
