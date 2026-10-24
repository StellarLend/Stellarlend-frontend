import { StrKey } from "@stellar/stellar-sdk";

/**
 * Validates whether a string is a valid StrKey-encoded Soroban Contract ID (starts with 'C', 56 chars).
 */
export function isValidContractAddress(address?: string | null): boolean {
  if (!address || typeof address !== "string") return false;
  const trimmed = address.trim();
  if (!/^C[A-Z0-9]{55}$/.test(trimmed)) return false;
  try {
    return StrKey.isValidContract(trimmed);
  } catch {
    return false;
  }
}

const rawMultisigId = (process.env.NEXT_PUBLIC_MULTISIG_CONTRACT_ID || "").trim();
const validatedMultisigId = isValidContractAddress(rawMultisigId) ? rawMultisigId : "";

export const config = {
  network: process.env.NEXT_PUBLIC_STELLAR_NETWORK || "testnet",
  horizon: process.env.NEXT_PUBLIC_HORIZON_URL || "https://horizon-testnet.stellar.org",
  rpc: process.env.NEXT_PUBLIC_SOROBAN_RPC_URL || "https://soroban-testnet.stellar.org",
  lendingId: process.env.NEXT_PUBLIC_LENDING_CONTRACT_ID || "",
  oracleId: process.env.NEXT_PUBLIC_ORACLE_CONTRACT_ID || "",
  tokenId: process.env.NEXT_PUBLIC_TOKEN_CONTRACT_ID || "",
  multisigId: validatedMultisigId,
  isMultisigConfigured: Boolean(validatedMultisigId),
  networkPassphrase: process.env.NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE || "Test SDF Network ; September 2015",
  ammId: process.env.NEXT_PUBLIC_AMM_CONTRACT_ID || "",
  ammTokenAId: process.env.NEXT_PUBLIC_AMM_TOKEN_A_CONTRACT_ID || "",
  ammTokenBId: process.env.NEXT_PUBLIC_AMM_TOKEN_B_CONTRACT_ID || "",
  ammTokenAHorizonAsset: process.env.NEXT_PUBLIC_AMM_TOKEN_A_HORIZON_ASSET || "",
  ammTokenBHorizonAsset: process.env.NEXT_PUBLIC_AMM_TOKEN_B_HORIZON_ASSET || "",
};

export const explorer = (id: string) => `https://stellar.expert/explorer/testnet/contract/${id}`;
export const accountExplorer = (id: string) => `https://stellar.expert/explorer/testnet/account/${id}`;
export const txExplorer = (hash: string) => `https://stellar.expert/explorer/testnet/tx/${hash}`;
