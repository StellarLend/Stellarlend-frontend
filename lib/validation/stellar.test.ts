import { describe, expect, test } from 'vitest';
import { isAccountId, isMuxedAccount, isContractId, isValidTxHash } from '@/lib/validation/stellar';

// Known valid/invalid sample addresses (using Stellar testnet examples)
const validG = 'GATTYSMDCYWYAWNJZXY2RGNHDZ7ZDEKRGJY4JOMHMDU6LANVFCI2U45X'; // valid G address
const invalidG = 'GATTYSMDCYWYAWNJZXY2RGNHDZ7ZDEKRGJY4JOMHMDU6LANVFCI2U45Y'; // altered last char

const validM = 'MAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABQ'; // placeholder valid M format (56+ chars)
const invalidM = 'MZINVALIDADDRESS1234567890';

const validC = 'CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'; // valid C format (56 chars)
const invalidC = 'CZINVALIDADDRESS1234567890';

describe('Stellar address validation helpers', () => {
  test('isAccountId validates correct G address', () => {
    expect(isAccountId(validG)).toBe(true);
  });

  test('isAccountId rejects invalid G address', () => {
    expect(isAccountId(invalidG)).toBe(false);
  });

  test('isMuxedAccount validates correct M address format', () => {
    expect(isMuxedAccount(validM)).toBe(true);
  });

  test('isMuxedAccount rejects invalid M address', () => {
    expect(isMuxedAccount(invalidM)).toBe(false);
  });

  test('isContractId validates correct C address format', () => {
    expect(isContractId(validC)).toBe(true);
  });

  test('isContractId rejects invalid C address', () => {
    expect(isContractId(invalidC)).toBe(false);
  });
});

describe('Stellar transaction hash validation helper', () => {
  test('isValidTxHash validates 64-character hexadecimal hashes', () => {
    const validHash = 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6abcd';
    expect(isValidTxHash(validHash)).toBe(true);
    expect(isValidTxHash(validHash.toUpperCase())).toBe(true);
  });

  test('isValidTxHash validates mock IDs', () => {
    expect(isValidTxHash('TXN12345')).toBe(true);
    expect(isValidTxHash('TXN0')).toBe(true);
  });

  test('isValidTxHash rejects invalid formats', () => {
    expect(isValidTxHash('invalid-hash')).toBe(false);
    expect(isValidTxHash('TXN')).toBe(false);
    // 63 hex characters
    expect(isValidTxHash('a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6abc')).toBe(false);
    // 65 hex characters
    expect(isValidTxHash('a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6abcde')).toBe(false);
    // Non-hex characters
    expect(isValidTxHash('a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6abcg')).toBe(false);
  });
});

