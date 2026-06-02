import { describe, expect, test } from 'vitest';
import { isAccountId, isMuxedAccount, isContractId } from '@/lib/validation/stellar';

// Known valid/invalid sample addresses (using Stellar testnet examples)
const validG = 'GB3JDWCQ5L5OPXKMG5B5X6K3X6JH6S2YVZB5A2UOCTMDEK5R5R5N3Y5R'; // example valid G address length 56
const invalidG = 'GB3JDWCQ5L5OPXKMG5B5X6K3X6JH6S2YVZB5A2UOCTMDEK5R5R5N3Y5X'; // altered last char

const validM = 'MAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABQ'; // placeholder valid M format (56+ chars)
const invalidM = 'MZINVALIDADDRESS1234567890';

const validC = 'CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABQ'; // placeholder valid C format
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
