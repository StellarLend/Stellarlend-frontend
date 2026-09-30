import type { StellarNetwork } from "@/context/WalletContext";
import type { Transaction } from "@/types/Transaction";

const STELLAR_TX_HASH_PATTERN = /^[0-9a-fA-F]{64}$/;

export function getTransactionHash(transaction: Transaction) {
  const candidate = transaction.txHash ?? transaction.hash ?? transaction.id;

  if (!STELLAR_TX_HASH_PATTERN.test(candidate)) {
    return null;
  }

  return candidate.toLowerCase();
}

export function buildStellarExpertTransactionUrl(
  hash: string,
  network: StellarNetwork,
) {
  const explorerNetwork = network === "PUBLIC" ? "public" : "testnet";
  return `https://stellar.expert/explorer/${explorerNetwork}/tx/${hash}`;
}
