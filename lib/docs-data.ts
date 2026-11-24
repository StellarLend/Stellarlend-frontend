import { config, explorer, isValidContractAddress } from "./config";
import { formatTokenDisplay } from "./format";
import { fetchLiveMarketParams } from "./market-params";
import { MARKETS, type Market, type ParamSource } from "./markets";

export interface DocsMarketRow {
  symbol: string;
  name: string;
  decimals: number;
  ltvBps: number;
  liqThresholdBps: number;
  supplyCap: string | null;
  borrowCap: string | null;
  minBorrow: string | null;
  supplyApyBps: number;
  borrowApyBps: number;
  source: ParamSource;
}

export type DocsContractKey =
  | "lending"
  | "oracle"
  | "token"
  | "multisig"
  | "amm"
  | "ammTokenA"
  | "ammTokenB";

export interface DocsContractRow {
  key: DocsContractKey;
  contractId: string;
  explorerUrl: string | null;
  source: ParamSource;
}

export interface DocsData {
  markets: DocsMarketRow[];
  contracts: DocsContractRow[];
  source: ParamSource;
  rpcFailed: boolean;
  network: string;
}

function toDocsMarketRow(m: Market): DocsMarketRow {
  const ltvBps = m.ltvBps ?? Math.round(m.ltv * 10000);
  const liqThresholdBps = m.liqThresholdBps ?? 8000;
  const supplyCap =
    m.supplyCap && m.supplyCap > 0n
      ? formatTokenDisplay(m.supplyCap, m.decimals, m.symbol)
      : null;
  const borrowCap =
    m.borrowCap && m.borrowCap > 0n
      ? formatTokenDisplay(m.borrowCap, m.decimals, m.symbol)
      : null;
  const minBorrow =
    m.minBorrow && m.minBorrow > 0n
      ? formatTokenDisplay(m.minBorrow, m.decimals, m.symbol)
      : null;

  const hasChainSource = Boolean(
    m.sources &&
      (m.sources.ltv === "chain" ||
        m.sources.liqThreshold === "chain" ||
        m.sources.supplyCap === "chain" ||
        m.sources.borrowCap === "chain" ||
        m.sources.minBorrow === "chain")
  );

  return {
    symbol: m.symbol,
    name: m.name,
    decimals: m.decimals,
    ltvBps,
    liqThresholdBps,
    supplyCap,
    borrowCap,
    minBorrow,
    supplyApyBps: Math.round(m.supplyApy * 100),
    borrowApyBps: Math.round(m.borrowApy * 100),
    source: hasChainSource ? "chain" : "demo",
  };
}

export function getDocsContracts(): DocsContractRow[] {
  const entries: Array<{ key: DocsContractKey; contractId: string }> = [
    { key: "lending", contractId: config.lendingId },
    { key: "oracle", contractId: config.oracleId },
    { key: "token", contractId: config.tokenId },
    { key: "multisig", contractId: config.multisigId },
    { key: "amm", contractId: config.ammId },
    { key: "ammTokenA", contractId: config.ammTokenAId },
    { key: "ammTokenB", contractId: config.ammTokenBId },
  ];

  return entries.map(({ key, contractId }) => {
    const deployed = Boolean(contractId);
    return {
      key,
      contractId,
      explorerUrl: deployed ? explorer.contract(contractId) : null,
      source: deployed ? "chain" : "demo",
    };
  });
}

export function getStaticDocsData(rpcFailed = false): DocsData {
  return {
    markets: MARKETS.map(toDocsMarketRow),
    contracts: getDocsContracts(),
    source: "demo",
    rpcFailed,
    network: config.network,
  };
}

/**
 * Fetches live risk parameters and deployed contract IDs for the docs page.
 * Intended to be called from the server component with `revalidate = 300`.
 * Gracefully falls back to static demo parameters when RPC fails.
 */
export async function getDocsData(
  fetcher: (markets?: Market[]) => Promise<Market[]> = fetchLiveMarketParams
): Promise<DocsData> {
  const contracts = getDocsContracts();
  try {
    const liveMarkets = await fetcher(MARKETS);
    const rows = liveMarkets.map(toDocsMarketRow);
    const anyChain = rows.some((row) => row.source === "chain");
    const lendingConfigured = isValidContractAddress(config.lendingId);
    const rpcFailed = lendingConfigured && !anyChain;

    return {
      markets: rows,
      contracts,
      source: anyChain ? "chain" : "demo",
      rpcFailed,
      network: config.network,
    };
  } catch {
    return {
      markets: MARKETS.map(toDocsMarketRow),
      contracts,
      source: "demo",
      rpcFailed: true,
      network: config.network,
    };
  }
}
