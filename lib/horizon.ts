import * as StellarSdk from "@stellar/stellar-sdk";
import { config } from "./config";
import type { AssetIdentity } from "./markets";

export interface BalanceDetail {
  assetType: string;
  code: string;
  issuer?: string;
  balance: string;
  available: string;
  limit?: string;
  buyingLiabilities: string;
  sellingLiabilities: string;
}

export type AccountBalancesMap = Record<string, BalanceDetail>;

/** XLM locked into the account's reserve for one additional trustline. */
export const TRUSTLINE_RESERVE_XLM = 0.5;

/** Minimal shape of a Horizon account payload needed for reserve math. */
export interface HorizonAccount {
  subentry_count?: number;
  num_sponsoring?: number;
  num_sponsored?: number;
  [key: string]: unknown;
}

export interface AccountBalancesResult {
  isUnfunded: boolean;
  balances: AccountBalancesMap;
  rawAccount?: HorizonAccount;
}

export function getAssetKey(asset: AssetIdentity): string {
  if (asset === "native") return "native";
  return `${asset.code}:${asset.issuer}`;
}

/**
 * Whether the account still needs a trustline for the market's classic asset.
 * Detection looks the asset up via getAssetKey against the balances map.
 * Native markets never need a trustline.
 */
export function needsTrustline(
  market: { asset?: AssetIdentity } | null | undefined,
  balances: AccountBalancesMap
): boolean {
  const asset = market?.asset;
  if (!asset || asset === "native") return false;
  return !balances[getAssetKey(asset)];
}

export type TrustlineErrorKind = "rejected" | "lowReserve" | "failed";

/** Classifies a trustline failure so the UI can render a localized message. */
export function classifyTrustlineError(error: unknown): TrustlineErrorKind {
  const message = (error instanceof Error ? error.message : String(error ?? "")).toLowerCase();
  if (
    message.includes("op_low_reserve") ||
    message.includes("insufficient xlm") ||
    message.includes("reserve")
  ) {
    return "lowReserve";
  }
  if (
    message.includes("reject") ||
    message.includes("cancel") ||
    message.includes("declin") ||
    message.includes("closed")
  ) {
    return "rejected";
  }
  return "failed";
}

export function calculateMinReserve(
  account: HorizonAccount,
  baseReserve = 0.5
): number {
  const subentries = account.subentry_count ?? 0;
  const numSponsoring = account.num_sponsoring ?? 0;
  const numSponsored = account.num_sponsored ?? 0;
  return (2 + subentries + numSponsoring - numSponsored) * baseReserve;
}

export function parseAccountBalances(accountData: any): AccountBalancesMap {
  const map: AccountBalancesMap = {};
  if (!accountData || !Array.isArray(accountData.balances)) {
    return map;
  }

  const minReserve = calculateMinReserve(accountData);

  for (const b of accountData.balances) {
    const balance = b.balance ?? "0";
    const buyingLiabilities = b.buying_liabilities ?? "0";
    const sellingLiabilities = b.selling_liabilities ?? "0";

    if (b.asset_type === "native") {
      const balNum = parseFloat(balance);
      const sellNum = parseFloat(sellingLiabilities);
      const availNum = Math.max(0, balNum - sellNum - minReserve);
      const detail: BalanceDetail = {
        assetType: "native",
        code: "XLM",
        balance,
        available: availNum.toFixed(7),
        buyingLiabilities,
        sellingLiabilities,
      };
      map["native"] = detail;
      map["XLM"] = detail;
    } else if (b.asset_code && b.asset_issuer) {
      const balNum = parseFloat(balance);
      const sellNum = parseFloat(sellingLiabilities);
      const availNum = Math.max(0, balNum - sellNum);
      const detail: BalanceDetail = {
        assetType: b.asset_type,
        code: b.asset_code,
        issuer: b.asset_issuer,
        balance,
        available: availNum.toFixed(7),
        limit: b.limit,
        buyingLiabilities,
        sellingLiabilities,
      };
      const key = `${b.asset_code}:${b.asset_issuer}`;
      map[key] = detail;
      if (!map[b.asset_code]) {
        map[b.asset_code] = detail;
      }
    }
  }

  return map;
}

export async function fetchWithRetry(
  url: string,
  options?: RequestInit,
  maxRetries = 3,
  initialBackoffMs = 200
): Promise<Response> {
  let attempt = 0;
  let delay = initialBackoffMs;

  while (attempt < maxRetries) {
    attempt++;
    try {
      const res = await fetch(url, options);
      if (res.ok || (res.status >= 400 && res.status < 500)) {
        return res;
      }
      if (attempt >= maxRetries) {
        return res;
      }
    } catch (err) {
      if (attempt >= maxRetries) {
        throw err;
      }
    }

    await new Promise((resolve) => setTimeout(resolve, delay));
    delay *= 2;
  }

  throw new Error(`Failed to fetch ${url} after ${maxRetries} attempts`);
}

export async function getAccountBalances(
  address: string,
  horizonUrl = config.horizon
): Promise<AccountBalancesResult> {
  const url = `${horizonUrl}/accounts/${address}`;
  const res = await fetchWithRetry(url);

  if (res.status === 404) {
    return {
      isUnfunded: true,
      balances: {},
    };
  }

  if (!res.ok) {
    throw new Error(`Horizon error (${res.status}): failed to fetch account ${address}`);
  }

  const accountData = await res.json();
  return {
    isUnfunded: false,
    balances: parseAccountBalances(accountData),
    rawAccount: accountData,
  };
}

export function buildChangeTrustTransaction(params: {
  account: any;
  asset: { code: string; issuer: string };
  limit?: string;
  networkPassphrase?: string;
  fee?: string;
}): StellarSdk.Transaction {
  const stellarAsset = new StellarSdk.Asset(params.asset.code, params.asset.issuer);
  const passphrase = params.networkPassphrase || config.networkPassphrase;

  return new StellarSdk.TransactionBuilder(params.account, {
    fee: params.fee || "100",
    networkPassphrase: passphrase,
  })
    .addOperation(
      StellarSdk.Operation.changeTrust({
        asset: stellarAsset,
        limit: params.limit,
      })
    )
    .setTimeout(30)
    .build();
}

export async function addTrustline(params: {
  address: string;
  asset: { code: string; issuer: string };
  limit?: string;
  horizonUrl?: string;
  networkPassphrase?: string;
}): Promise<{ hash: string }> {
  const horizonUrl = params.horizonUrl || config.horizon;
  const networkPassphrase = params.networkPassphrase || config.networkPassphrase;

  const accRes = await fetchWithRetry(`${horizonUrl}/accounts/${params.address}`);
  if (accRes.status === 404) {
    throw new Error("Account is unfunded on testnet. Fund account with testnet XLM first.");
  }
  if (!accRes.ok) {
    throw new Error(`Failed to fetch account for sequence: ${accRes.status}`);
  }

  const accountData = await accRes.json();
  const balances = parseAccountBalances(accountData);

  const nativeAvailable = parseFloat(balances["native"]?.available ?? "0");
  if (nativeAvailable < TRUSTLINE_RESERVE_XLM) {
    throw new Error("Insufficient XLM to cover the trustline reserve (requires at least 0.5 XLM).");
  }

  const account = new StellarSdk.Account(accountData.id, accountData.sequence);
  const tx = buildChangeTrustTransaction({
    account,
    asset: params.asset,
    limit: params.limit,
    networkPassphrase,
  });

  const freighterApi = await import("@stellar/freighter-api");
  const signed = await freighterApi.signTransaction(tx.toXDR(), { networkPassphrase });

  const signedXdr = typeof signed === "string" ? signed : (signed as any)?.signedTxXdr;
  if (!signedXdr) {
    throw new Error("Transaction was rejected or cancelled by user");
  }

  const body = new URLSearchParams();
  body.append("tx", signedXdr);

  const submitRes = await fetchWithRetry(`${horizonUrl}/transactions`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  const submitJson = await submitRes.json();
  if (!submitRes.ok) {
    const resultCodes = submitJson?.extras?.result_codes;
    const errorMsg =
      resultCodes?.operations?.[0] ||
      resultCodes?.transaction ||
      submitJson?.detail ||
      submitJson?.title ||
      "Failed to submit changeTrust transaction";
    throw new Error(errorMsg);
  }

  return { hash: submitJson.hash };
}
