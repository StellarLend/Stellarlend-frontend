import { getAssets, type AssetMetadata } from "@/lib/assets/registry";
import { publicConfig } from "@/lib/config";
import { formatCurrency } from "@/lib/utils/format";

interface HorizonBalance {
  balance: string;
  asset_type: string;
  asset_code?: string;
}

interface HorizonAccountResponse {
  balances?: HorizonBalance[];
}

export interface WalletBalanceSummaryItem {
  symbol: string;
  name: string;
  amount: number;
  formatted: string;
  hasMetadata: boolean;
}

function getBalanceSymbol(balance: HorizonBalance): string {
  return balance.asset_type === "native"
    ? "XLM"
    : balance.asset_code || "UNKNOWN";
}

export function formatWalletBalance(
  balance: HorizonBalance,
  assets: AssetMetadata[] = getAssets(),
): WalletBalanceSummaryItem {
  const symbol = getBalanceSymbol(balance);
  const metadata = assets.find((asset) => asset.symbol === symbol);
  const amount = Number(balance.balance);
  const safeAmount = Number.isFinite(amount) ? amount : 0;
  const decimals = metadata?.decimals ?? 7;

  return {
    symbol,
    name: metadata?.name ?? "Unknown asset",
    amount: safeAmount,
    formatted: formatCurrency(safeAmount, decimals),
    hasMetadata: Boolean(metadata),
  };
}

export function normalizeWalletBalances(
  balances: HorizonBalance[] = [],
  assets: AssetMetadata[] = getAssets(),
): WalletBalanceSummaryItem[] {
  return balances
    .map((balance) => formatWalletBalance(balance, assets))
    .sort((a, b) => {
      if (a.symbol === "XLM") return -1;
      if (b.symbol === "XLM") return 1;
      return a.symbol.localeCompare(b.symbol);
    });
}

export async function fetchWalletBalances(
  account: string,
  horizonUrl: string = publicConfig.stellar.horizonUrl,
): Promise<WalletBalanceSummaryItem[]> {
  const baseUrl = horizonUrl.replace(/\/$/, "");
  const response = await fetch(
    `${baseUrl}/accounts/${encodeURIComponent(account)}`,
  );

  if (!response.ok) {
    throw new Error("Unable to load wallet balances");
  }

  const data = (await response.json()) as HorizonAccountResponse;
  return normalizeWalletBalances(data.balances ?? []);
}
