export const config = {
  network: process.env.NEXT_PUBLIC_STELLAR_NETWORK || "testnet",
  horizon: process.env.NEXT_PUBLIC_HORIZON_URL || "https://horizon-testnet.stellar.org",
  rpc: process.env.NEXT_PUBLIC_SOROBAN_RPC_URL || "https://soroban-testnet.stellar.org",
  lendingId: process.env.NEXT_PUBLIC_LENDING_CONTRACT_ID || "",
  oracleId: process.env.NEXT_PUBLIC_ORACLE_CONTRACT_ID || "",
  tokenId: process.env.NEXT_PUBLIC_TOKEN_CONTRACT_ID || "",
  multisigId: process.env.NEXT_PUBLIC_MULTISIG_CONTRACT_ID || "",
  networkPassphrase: process.env.NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE || "Test SDF Network ; September 2015",
  ammId: process.env.NEXT_PUBLIC_AMM_CONTRACT_ID || "",
  ammTokenAId: process.env.NEXT_PUBLIC_AMM_TOKEN_A_CONTRACT_ID || "",
  ammTokenBId: process.env.NEXT_PUBLIC_AMM_TOKEN_B_CONTRACT_ID || "",
  ammTokenAHorizonAsset: process.env.NEXT_PUBLIC_AMM_TOKEN_A_HORIZON_ASSET || "",
  ammTokenBHorizonAsset: process.env.NEXT_PUBLIC_AMM_TOKEN_B_HORIZON_ASSET || "",
};
export const explorer = (id: string) => `https://stellar.expert/explorer/testnet/contract/${id}`;
export const txExplorer = (hash: string) => `https://stellar.expert/explorer/testnet/tx/${hash}`;

export const NETWORK_PASSPHRASES = {
  testnet: "Test SDF Network ; September 2015",
  public: "Public Global Stellar Network ; September 2015",
  mainnet: "Public Global Stellar Network ; September 2015",
  futurenet: "Test SDF Future Network ; October 2022",
  standalone: "Standalone Network ; February 2017",
  sandbox: "Local Sandbox Stellar Network ; September 2022",
} as const;

export function getExpectedNetworkPassphrase(networkName?: string): string {
  if (networkName) {
    const key = networkName.toLowerCase() as keyof typeof NETWORK_PASSPHRASES;
    if (NETWORK_PASSPHRASES[key]) return NETWORK_PASSPHRASES[key];
  }
  if (config.networkPassphrase && config.networkPassphrase.trim() !== "") {
    return config.networkPassphrase;
  }
  const key = (config.network || "testnet").toLowerCase() as keyof typeof NETWORK_PASSPHRASES;
  return NETWORK_PASSPHRASES[key] ?? NETWORK_PASSPHRASES.testnet;
}

export function isNetworkMismatch(currentPassphrase: string | null | undefined, expectedPassphrase = getExpectedNetworkPassphrase()): boolean {
  if (!currentPassphrase) return false;
  return currentPassphrase !== expectedPassphrase;
}

export class NetworkMismatchError extends Error {
  readonly currentPassphrase: string;
  readonly expectedPassphrase: string;

  constructor(currentPassphrase: string, expectedPassphrase: string) {
    super(`Freighter network passphrase "${currentPassphrase}" does not match configured app network passphrase "${expectedPassphrase}".`);
    this.name = "NetworkMismatchError";
    this.currentPassphrase = currentPassphrase;
    this.expectedPassphrase = expectedPassphrase;
    Object.setPrototypeOf(this, NetworkMismatchError.prototype);
  }
}

