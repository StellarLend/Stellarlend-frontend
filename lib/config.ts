import { Networks, StrKey } from "@stellar/stellar-sdk";
import { z } from "zod";

// Well-known Stellar testnet asset issuers
// Source for USDC & EURC: Circle official testnet documentation
// https://developers.circle.com/stablecoins/docs/stellar-testnet-usdc
export const TESTNET_ISSUERS = {
  USDC: process.env.NEXT_PUBLIC_USDC_ISSUER || "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
  EURC: process.env.NEXT_PUBLIC_EURC_ISSUER || "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
  // Demo testnet BTC anchor issuer
  BTC: process.env.NEXT_PUBLIC_BTC_ISSUER || "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
};

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

export const STELLAR_NETWORKS = ["testnet", "futurenet", "mainnet"] as const;
export type StellarNetwork = (typeof STELLAR_NETWORKS)[number];

export const NETWORK_PASSPHRASES = {
  testnet: "Test SDF Network ; September 2015",
  public: "Public Global Stellar Network ; September 2015",
  mainnet: "Public Global Stellar Network ; September 2015",
  futurenet: "Test SDF Future Network ; October 2022",
  standalone: "Standalone Network ; February 2017",
  sandbox: "Local Sandbox Stellar Network ; September 2022",
} as const;

const EXPLORER_NETWORK_SEGMENTS: Record<StellarNetwork, string> = {
  testnet: "testnet",
  futurenet: "futurenet",
  mainnet: "public",
};

function normalizeUrl(val: string): string {
  return val.trim().replace(/\/+$/, "");
}

function isValidHttpOrHttpsUrl(val: string, allowHttpLocalhost: boolean): boolean {
  try {
    const url = new URL(val);
    if (url.protocol === "https:") return true;
    if (url.protocol === "http:") {
      if (allowHttpLocalhost) {
        return (
          url.hostname === "localhost" ||
          url.hostname === "127.0.0.1" ||
          url.hostname === "::1" ||
          url.hostname === "[::1]"
        );
      }
      return false;
    }
    return false;
  } catch {
    return false;
  }
}

export function createUrlSchema(isDev: boolean, fieldName: string) {
  return z
    .string()
    .min(1, `${fieldName} is required`)
    .transform(normalizeUrl)
    .refine(
      (val) => isValidHttpOrHttpsUrl(val, isDev),
      {
        message: isDev
          ? `${fieldName} must be a valid https URL (or http for localhost)`
          : `${fieldName} must be a valid https URL`,
      }
    );
}

export function createContractIdSchema(fieldName: string, isOptional = false) {
  return z
    .string()
    .optional()
    .transform((val) => (val ? val.trim() : ""))
    .refine(
      (val) => {
        if (!val) return isOptional;
        return StrKey.isValidContract(val);
      },
      {
        message: `${fieldName} must be a valid C... Soroban contract address`,
      }
    );
}

export function createConfigSchema(isDev: boolean) {
  return z.object({
    NEXT_PUBLIC_STELLAR_NETWORK: z.enum(
      { testnet: "testnet", futurenet: "futurenet", mainnet: "mainnet" },
      { error: "NEXT_PUBLIC_STELLAR_NETWORK must be 'testnet', 'futurenet', or 'mainnet'" }
    ),
    NEXT_PUBLIC_HORIZON_URL: createUrlSchema(isDev, "NEXT_PUBLIC_HORIZON_URL"),
    NEXT_PUBLIC_SOROBAN_RPC_URL: createUrlSchema(isDev, "NEXT_PUBLIC_SOROBAN_RPC_URL"),
    NEXT_PUBLIC_LENDING_CONTRACT_ID: createContractIdSchema("NEXT_PUBLIC_LENDING_CONTRACT_ID", true),
    NEXT_PUBLIC_ORACLE_CONTRACT_ID: createContractIdSchema("NEXT_PUBLIC_ORACLE_CONTRACT_ID", true),
    NEXT_PUBLIC_TOKEN_CONTRACT_ID: createContractIdSchema("NEXT_PUBLIC_TOKEN_CONTRACT_ID", true),
    // Invalid multisig IDs are treated as "not configured" (multisig UI shows its setup state).
    NEXT_PUBLIC_MULTISIG_CONTRACT_ID: z
      .string()
      .optional()
      .transform((val) => (val && isValidContractAddress(val) ? val.trim() : "")),
    NEXT_PUBLIC_AMM_CONTRACT_ID: createContractIdSchema("NEXT_PUBLIC_AMM_CONTRACT_ID", true),
    NEXT_PUBLIC_AMM_TOKEN_A_CONTRACT_ID: createContractIdSchema("NEXT_PUBLIC_AMM_TOKEN_A_CONTRACT_ID", true),
    NEXT_PUBLIC_AMM_TOKEN_B_CONTRACT_ID: createContractIdSchema("NEXT_PUBLIC_AMM_TOKEN_B_CONTRACT_ID", true),
    NEXT_PUBLIC_AMM_TOKEN_A_HORIZON_ASSET: z.string().optional().default(""),
    NEXT_PUBLIC_AMM_TOKEN_B_HORIZON_ASSET: z.string().optional().default(""),
    NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE: z.string().optional(),
    NEXT_PUBLIC_SOROBAN_RPC_FALLBACK_URLS: z.string().optional(),
    NEXT_PUBLIC_XLM_ASSET_ADDRESS: z.string().optional(),
    NEXT_PUBLIC_USDC_ASSET_ADDRESS: z.string().optional(),
    NEXT_PUBLIC_EURC_ASSET_ADDRESS: z.string().optional(),
    NEXT_PUBLIC_BTC_ASSET_ADDRESS: z.string().optional(),
  });
}

export interface AppConfig {
  network: StellarNetwork;
  horizon: string;
  rpc: string;
  rpcFallbacks: string[];
  lendingId: string;
  oracleId: string;
  tokenId: string;
  multisigId: string;
  isMultisigConfigured: boolean;
  ammId: string;
  ammTokenAId: string;
  ammTokenBId: string;
  ammTokenAHorizonAsset: string;
  ammTokenBHorizonAsset: string;
  networkPassphrase: string;
  /** Per-market on-chain asset contract addresses (for get_asset_params etc.). */
  marketAssets: Record<string, string>;
}

export interface ExplorerHelpers {
  (id: string): string;
  contract: (id: string) => string;
  tx: (hash: string) => string;
  account: (addr: string) => string;
}

export function createExplorerHelpers(network: StellarNetwork): ExplorerHelpers {
  const segment = EXPLORER_NETWORK_SEGMENTS[network] || "testnet";
  const base = `https://stellar.expert/explorer/${segment}`;

  const helper = ((id: string) => `${base}/contract/${id}`) as ExplorerHelpers;
  helper.contract = (id: string) => `${base}/contract/${id}`;
  helper.tx = (hash: string) => `${base}/tx/${hash}`;
  helper.account = (addr: string) => `${base}/account/${addr}`;

  return helper;
}

export function parseEnvFile(content: string): Record<string, string> {
  const result: Record<string, string> = {};
  const lines = content.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let val = trimmed.slice(eqIdx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    result[key] = val;
  }
  return result;
}

export function validateConfig(
  rawEnv: Record<string, string | undefined>,
  options: { isDev?: boolean } = {}
): AppConfig {
  const isDev = options.isDev ?? (process.env.NODE_ENV === "development");
  const schema = createConfigSchema(isDev);
  const result = schema.safeParse(rawEnv);

  if (!result.success) {
    const errors = result.error.issues.map((err) => {
      const field = err.path.join(".") || "Configuration";
      return `  - ${field}: ${err.message}`;
    });
    const message = [
      "Invalid application network configuration:",
      ...errors,
      "Please verify your environment variables or .env file before building.",
    ].join("\n");
    throw new Error(message);
  }

  const data = result.data;
  const network = data.NEXT_PUBLIC_STELLAR_NETWORK as StellarNetwork;
  const derivedPassphrase =
    data.NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE ||
    NETWORK_PASSPHRASES[network] ||
    Networks.TESTNET;

  return {
    network,
    horizon: data.NEXT_PUBLIC_HORIZON_URL,
    rpc: data.NEXT_PUBLIC_SOROBAN_RPC_URL,
    rpcFallbacks: (data.NEXT_PUBLIC_SOROBAN_RPC_FALLBACK_URLS || "")
      .split(",")
      .map((u) => u.trim())
      .filter(Boolean),
    lendingId: data.NEXT_PUBLIC_LENDING_CONTRACT_ID || "",
    oracleId: data.NEXT_PUBLIC_ORACLE_CONTRACT_ID || "",
    tokenId: data.NEXT_PUBLIC_TOKEN_CONTRACT_ID || "",
    multisigId: data.NEXT_PUBLIC_MULTISIG_CONTRACT_ID || "",
    isMultisigConfigured: Boolean(data.NEXT_PUBLIC_MULTISIG_CONTRACT_ID),
    ammId: data.NEXT_PUBLIC_AMM_CONTRACT_ID || "",
    ammTokenAId: data.NEXT_PUBLIC_AMM_TOKEN_A_CONTRACT_ID || "",
    ammTokenBId: data.NEXT_PUBLIC_AMM_TOKEN_B_CONTRACT_ID || "",
    ammTokenAHorizonAsset: data.NEXT_PUBLIC_AMM_TOKEN_A_HORIZON_ASSET || "",
    ammTokenBHorizonAsset: data.NEXT_PUBLIC_AMM_TOKEN_B_HORIZON_ASSET || "",
    networkPassphrase: derivedPassphrase,
    marketAssets: {
      XLM: data.NEXT_PUBLIC_XLM_ASSET_ADDRESS || "",
      USDC: data.NEXT_PUBLIC_USDC_ASSET_ADDRESS || "",
      EURC: data.NEXT_PUBLIC_EURC_ASSET_ADDRESS || "",
      BTC: data.NEXT_PUBLIC_BTC_ASSET_ADDRESS || "",
    },
  };
}

let activeConfig: AppConfig;

function getRuntimeEnv(): Record<string, string | undefined> {
  const fallbackNetwork = process.env.NEXT_PUBLIC_STELLAR_NETWORK || "testnet";
  const defaultHorizon =
    fallbackNetwork === "mainnet"
      ? "https://horizon.stellar.org"
      : fallbackNetwork === "futurenet"
      ? "https://horizon-futurenet.stellar.org"
      : "https://horizon-testnet.stellar.org";
  const defaultRpc =
    fallbackNetwork === "mainnet"
      ? "https://soroban-rpc.mainnet.stellar.org"
      : fallbackNetwork === "futurenet"
      ? "https://rpc-futurenet.stellar.org"
      : "https://soroban-testnet.stellar.org";

  return {
    NEXT_PUBLIC_STELLAR_NETWORK: process.env.NEXT_PUBLIC_STELLAR_NETWORK || "testnet",
    NEXT_PUBLIC_HORIZON_URL: process.env.NEXT_PUBLIC_HORIZON_URL || defaultHorizon,
    NEXT_PUBLIC_SOROBAN_RPC_URL: process.env.NEXT_PUBLIC_SOROBAN_RPC_URL || defaultRpc,
    NEXT_PUBLIC_LENDING_CONTRACT_ID: process.env.NEXT_PUBLIC_LENDING_CONTRACT_ID,
    NEXT_PUBLIC_ORACLE_CONTRACT_ID: process.env.NEXT_PUBLIC_ORACLE_CONTRACT_ID,
    NEXT_PUBLIC_TOKEN_CONTRACT_ID: process.env.NEXT_PUBLIC_TOKEN_CONTRACT_ID,
    NEXT_PUBLIC_MULTISIG_CONTRACT_ID: process.env.NEXT_PUBLIC_MULTISIG_CONTRACT_ID,
    NEXT_PUBLIC_AMM_CONTRACT_ID: process.env.NEXT_PUBLIC_AMM_CONTRACT_ID,
    NEXT_PUBLIC_AMM_TOKEN_A_CONTRACT_ID: process.env.NEXT_PUBLIC_AMM_TOKEN_A_CONTRACT_ID,
    NEXT_PUBLIC_AMM_TOKEN_B_CONTRACT_ID: process.env.NEXT_PUBLIC_AMM_TOKEN_B_CONTRACT_ID,
    NEXT_PUBLIC_AMM_TOKEN_A_HORIZON_ASSET: process.env.NEXT_PUBLIC_AMM_TOKEN_A_HORIZON_ASSET,
    NEXT_PUBLIC_AMM_TOKEN_B_HORIZON_ASSET: process.env.NEXT_PUBLIC_AMM_TOKEN_B_HORIZON_ASSET,
    NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE: process.env.NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE,
    NEXT_PUBLIC_SOROBAN_RPC_FALLBACK_URLS: process.env.NEXT_PUBLIC_SOROBAN_RPC_FALLBACK_URLS,
    NEXT_PUBLIC_XLM_ASSET_ADDRESS: process.env.NEXT_PUBLIC_XLM_ASSET_ADDRESS,
    NEXT_PUBLIC_USDC_ASSET_ADDRESS: process.env.NEXT_PUBLIC_USDC_ASSET_ADDRESS,
    NEXT_PUBLIC_EURC_ASSET_ADDRESS: process.env.NEXT_PUBLIC_EURC_ASSET_ADDRESS,
    NEXT_PUBLIC_BTC_ASSET_ADDRESS: process.env.NEXT_PUBLIC_BTC_ASSET_ADDRESS,
  };
}

try {
  activeConfig = validateConfig(getRuntimeEnv());
} catch (err) {
  if (typeof window === "undefined") {
    throw err;
  }
  console.error("Configuration validation error:", err);
  const fallbackNetwork = "testnet";
  activeConfig = {
    network: fallbackNetwork,
    horizon: "https://horizon-testnet.stellar.org",
    rpc: "https://soroban-testnet.stellar.org",
    rpcFallbacks: [],
    lendingId: "",
    oracleId: "",
    tokenId: "",
    multisigId: "",
    isMultisigConfigured: false,
    ammId: "",
    ammTokenAId: "",
    ammTokenBId: "",
    ammTokenAHorizonAsset: "",
    ammTokenBHorizonAsset: "",
    networkPassphrase: Networks.TESTNET,
    marketAssets: { XLM: "", USDC: "", EURC: "", BTC: "" },
  };
}

export const config = activeConfig;
export const explorer = createExplorerHelpers(config.network);
export const txExplorer = (hash: string) => explorer.tx(hash);
export const accountExplorer = (id: string) => explorer.account(id);

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

export function isNetworkMismatch(
  currentPassphrase: string | null | undefined,
  expectedPassphrase = getExpectedNetworkPassphrase()
): boolean {
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
