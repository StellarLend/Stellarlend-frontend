import {
  ASSET_SYMBOLS,
  TRANSACTION_STATUSES,
  isAssetSymbol,
  isTransactionStatus,
  type AssetSymbol,
  type TransactionStatus,
} from "@/types/enums";

const VALID_STATUSES = new Set<string>(TRANSACTION_STATUSES);
const VALID_ASSETS = new Set<string>(ASSET_SYMBOLS);

function parseIntegerParam(value: string | null, fallback: number) {
  const parsed = parseInt(value || String(fallback), 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

export function parseTransactionParams(searchParams: URLSearchParams) {
  const page = Math.max(1, parseIntegerParam(searchParams.get("page"), 1));
  const rawPageSize = parseIntegerParam(searchParams.get("pageSize"), 10);
  const pageSize = Math.min(100, Math.max(1, rawPageSize)); // Clamped to 100 max
  const sort = searchParams.get("sort") || "date-desc";
  const status = searchParams.get("status") as TransactionStatus | null;
  const asset = searchParams.get("asset") as AssetSymbol | null;
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");

  const errors: string[] = [];
  if (status && !VALID_STATUSES.has(status)) errors.push("Invalid status");
  if (asset && !VALID_ASSETS.has(asset)) errors.push("Invalid asset");

  return {
    params: { page, pageSize, sort, status, asset, startDate, endDate },
    errors: errors.length > 0 ? errors : null,
  };
}

