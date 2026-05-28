import { Keypair, Networks, WebAuth, Transaction } from "@stellar/stellar-sdk";
import config from "@/lib/config";

// The server's signing keypair. In production, this should be a secure secret.
// For development, we fallback to a random keypair if not provided.
const SERVER_SIGNING_SECRET = process.env.STELLAR_SIGNING_SECRET;
let serverKeypair: Keypair;

try {
  if (SERVER_SIGNING_SECRET) {
    serverKeypair = Keypair.fromSecret(SERVER_SIGNING_SECRET);
  } else {
    console.warn("STELLAR_SIGNING_SECRET not found in environment, using a random keypair for development");
    serverKeypair = Keypair.random();
  }
} catch (error) {
  console.warn("Invalid STELLAR_SIGNING_SECRET, using a random keypair for development", error);
  serverKeypair = Keypair.random();
}

const NETWORK_PASSPHRASE =
  config.stellar.network === "mainnet"
    ? Networks.PUBLIC
    : Networks.TESTNET;

// Using the app name or domain for the SEP-10 domain
const HOME_DOMAIN = process.env.NEXT_PUBLIC_APP_DOMAIN || "localhost:3000";

/**
 * Generate a SEP-10 challenge transaction for a given Stellar public key
 * @param clientPublicKey The wallet address requesting authentication
 * @returns The base64-encoded XDR of the challenge transaction
 */
export async function generateWalletChallenge(clientPublicKey: string): Promise<string> {
  try {
    // Validate the public key
    Keypair.fromPublicKey(clientPublicKey);
  } catch (error) {
    throw new Error("Invalid Stellar public key");
  }

  // Set expiration to 5 minutes
  const timeout = 300; 

  const challengeTx = WebAuth.buildChallengeTx(
    serverKeypair,
    clientPublicKey,
    HOME_DOMAIN,
    timeout,
    NETWORK_PASSPHRASE,
    HOME_DOMAIN
  );

  return challengeTx;
}

/**
 * Verify a SEP-10 challenge transaction signature
 * @param transactionXdr The base64-encoded XDR of the signed transaction
 * @returns The validated client public key (wallet address)
 */
export async function verifyWalletSignature(transactionXdr: string): Promise<string> {
  try {
    // Read the transaction to extract the client's public key
    const { clientAccountID } = WebAuth.readChallengeTx(
      transactionXdr,
      serverKeypair.publicKey(),
      NETWORK_PASSPHRASE,
      HOME_DOMAIN,
      HOME_DOMAIN
    ) as any;

    const signersFound = WebAuth.verifyChallengeTxSigners(
      transactionXdr,
      serverKeypair.publicKey(),
      NETWORK_PASSPHRASE,
      [clientAccountID],
      HOME_DOMAIN,
      HOME_DOMAIN
    );

    if (signersFound.length === 0 || !signersFound.includes(clientAccountID)) {
      throw new Error("Invalid signature or challenge transaction");
    }

    return clientAccountID;
  } catch (error: any) {
    throw new Error(`Signature verification failed: ${error.message || "Unknown error"}`);
  }
}
