import { isAccountId } from "@/lib/validation/stellar";

export type StellarNetwork = "PUBLIC" | "TESTNET";

declare global {
  interface Window {
    stellar?: {
      getPublicKey: () => Promise<string>;
      signTransaction: (xdr: string, opts?: { network: string }) => Promise<string>;
      // Optional: not all wallet providers expose multiple accounts.
      getAccounts?: () => Promise<string[]>;
    };
  }
}

export function isValidStellarAddress(pubKey: string): boolean {
  return isAccountId(pubKey);
}

/**
 * Freighter -> SEP-10 challenge -> sign -> verify handshake shared by every
 * wallet-connect entry point. Keeping this in one place is what the two
 * previous copies (WalletContext and useWalletConnection) lacked: they had
 * drifted apart on public key validation, so an invalid key could be
 * accepted by one entry point and rejected by the other. Throws with a
 * message suitable for surfacing directly to the user.
 */
export async function connectWallet(network: StellarNetwork): Promise<string> {
  const stellar = window.stellar;
  if (!stellar) {
    throw new Error("Stellar wallet provider (Freighter) not detected");
  }

  const pubKey = await stellar.getPublicKey();
  if (!pubKey) {
    throw new Error("No public key returned from wallet");
  }

  if (!isValidStellarAddress(pubKey)) {
    throw new Error("Invalid Stellar public key");
  }

  const challengeResponse = await fetch("/api/auth/challenge", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ walletAddress: pubKey }),
  });

  if (!challengeResponse.ok) {
    const errData = await challengeResponse.json();
    throw new Error(errData.error || "Failed to generate challenge");
  }

  const { transaction } = await challengeResponse.json();

  const signedTransaction = await stellar.signTransaction(transaction, { network });

  const verifyResponse = await fetch("/api/auth/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ transaction: signedTransaction }),
  });

  if (!verifyResponse.ok) {
    const errData = await verifyResponse.json();
    throw new Error(errData.error || "Verification failed");
  }

  const { walletAddress } = await verifyResponse.json();
  if (!isValidStellarAddress(walletAddress)) {
    throw new Error("Verification returned an invalid wallet address");
  }
  if (walletAddress !== pubKey) {
    throw new Error("Verified wallet does not match the connected wallet");
  }

  return walletAddress;
}
