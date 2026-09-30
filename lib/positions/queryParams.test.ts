import { describe, expect, test } from 'vitest';
import { walletAddressSchema } from './queryParams';

// Reuse fixtures consistent with lib/validation/stellar
const VALID_ADDRESS = 'GATTYSMDCYWYAWNJZXY2RGNHDZ7ZDEKRGJY4JOMHMDU6LANVFCI2U45X';
const CHECKSUM_INVALID = 'GATTYSMDCYWYAWNJZXY2RGNHDZ7ZDEKRGJY4JOMHMDU6LANVFCI2U45Y'; // valid length, bad checksum
const OVERLONG = VALID_ADDRESS + 'A'; // 57 chars

describe('walletAddressSchema', () => {
  test('accepts a valid G-address', () => {
    const result = walletAddressSchema.safeParse(VALID_ADDRESS);
    expect(result.success).toBe(true);
  });

  test('rejects empty string', () => {
    const result = walletAddressSchema.safeParse('');
    expect(result.success).toBe(false);
    expect(result.error!.issues[0].message).toBe('Wallet address is required');
  });

  test('rejects non-string input (number)', () => {
    const result = walletAddressSchema.safeParse(12345);
    expect(result.success).toBe(false);
    expect(result.error!.issues[0].code).toBe('invalid_type');
  });

  test('rejects non-string input (null)', () => {
    const result = walletAddressSchema.safeParse(null);
    expect(result.success).toBe(false);
    expect(result.error!.issues[0].code).toBe('invalid_type');
  });

  test('rejects address longer than 56 chars', () => {
    const result = walletAddressSchema.safeParse(OVERLONG);
    expect(result.success).toBe(false);
    expect(result.error!.issues[0].message).toBe('Wallet address is too long');
  });

  test('rejects checksum-invalid address of correct length', () => {
    const result = walletAddressSchema.safeParse(CHECKSUM_INVALID);
    expect(result.success).toBe(false);
    expect(result.error!.issues[0].message).toBe('Invalid Stellar account address');
  });

  test('rejects structurally malformed address (wrong prefix)', () => {
    const result = walletAddressSchema.safeParse('XATTYSMDCYWYAWNJZXY2RGNHDZ7ZDEKRGJY4JOMHMDU6LANVFCI2U45X');
    expect(result.success).toBe(false);
    expect(result.error!.issues[0].message).toBe('Invalid Stellar account address');
  });
});
