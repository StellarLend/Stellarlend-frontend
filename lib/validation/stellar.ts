import { StrKey } from '@stellar/stellar-sdk';

/**
 * Validate a Stellar account ID (public key) which starts with 'G'.
 * Uses the official StrKey validator to ensure correct format and checksum.
 */
export function isAccountId(address: string): boolean {
  try {
    return StrKey.isValidEd25519PublicKey(address);
  } catch {
    return false;
  }
}

/**
 * Validate a Stellar muxed account ID which starts with 'M'.
 * The SDK does not expose a direct validator, so we perform a basic format check.
 * Muxed accounts are longer (typically 56+ characters) and use Base32 encoding.
 */
export function isMuxedAccount(address: string): boolean {
  // Basic regex for M-prefixed addresses (Base32 characters, length >= 56)
  const muxedRegex = /^M[A-Z2-7]{55,}$/;
  return muxedRegex.test(address);
}

/**
 * Validate a Stellar contract ID which starts with 'C'.
 * Uses a simple regex; for full checksum validation the SDK would need a dedicated method.
 */
export function isContractId(address: string): boolean {
  const contractRegex = /^C[A-Z2-7]{55}$/;
  return contractRegex.test(address);
}
