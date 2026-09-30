import { z } from 'zod';
import { isAccountId } from '@/lib/validation/stellar';

/**
 * Zod schema for validating Stellar wallet addresses.
 * Rejects non-string, empty, and structurally invalid addresses.
 */
export const walletAddressSchema = z
  .string()
  .min(1, 'Wallet address is required')
  .max(56, 'Wallet address is too long')
  .refine(isAccountId, 'Invalid Stellar account address');

export type WalletAddressInput = z.infer<typeof walletAddressSchema>;
