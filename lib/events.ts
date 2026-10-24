import {
  Address,
  nativeToScVal,
  rpc,
  scValToNative,
  xdr,
} from "@stellar/stellar-sdk";
import { config } from "@/lib/config";

export const EVENT_SCHEMA_VERSION = 1;
export const DEFAULT_PAGE_SIZE = 50;
// Testnet ledger closes ~every 5s, so 7 days is ~120,960 ledgers.
export const DEFAULT_RETENTION_LEDGERS = 120_000;
export const TOKEN_SCALE = BigInt(10_000_000);

export type LendingEventKind = "deposit" | "withdraw" | "borrow" | "repay";

export type LendingEvent = {
  id: string;
  kind: LendingEventKind;
  user: string;
  amount: bigint;
  after: bigint;
  timestamp: number;
  ledger: number;
  txHash: string;
  transactionIndex?: number;
  operationIndex?: number;
};

export type RawEventRecord = {
  id?: string;
  ledger?: number;
  transactionIndex?: number;
  operationIndex?: number;
  ledgerClosedAt?: string;
  txHash?: string;
  topic?: (xdr.ScVal | string)[];
  value?: xdr.ScVal | string;
};

export type GetLendingEventsOptions = {
  user?: string;
  startLedger?: number;
  cursor?: string;
  limit?: number;
  contractId?: string;
  rpcUrl?: string;
};

export type LendingEventsPage = {
  events: LendingEvent[];
  cursor: string;
  hasMore: boolean;
  oldestLedger?: number;
  latestLedger?: number;
};

export function canonicalAddress(addr: string): string | null {
  try {
    return Address.fromString(addr).toString();
  } catch {
    return null;
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value === "object" && value !== null) {
    if (value instanceof Map) {
      const obj: Record<string, unknown> = {};
      for (const [k, v] of value.entries()) {
        obj[String(k)] = v;
      }
      return obj;
    }
    return value as Record<string, unknown>;
  }
  return null;
}

function asBigInt(value: unknown): bigint | null {
  if (typeof value === "bigint") return value;
  if (typeof value === "number" && Number.isSafeInteger(value)) return BigInt(value);
  if (typeof value === "string" && /^-?\d+$/.test(value)) return BigInt(value);
  return null;
}

function extractUserAddress(val: unknown): string | null {
  if (!val) return null;
  if (typeof val === "string") {
    return canonicalAddress(val);
  }
  if (typeof val === "object" && val !== null) {
    if ("toString" in val && typeof (val as { toString: () => string }).toString === "function") {
      return canonicalAddress((val as { toString: () => string }).toString());
    }
  }
  return null;
}

function parseScVal(val: unknown): xdr.ScVal | null {
  if (!val) return null;
  if (typeof val === "string") {
    try {
      return xdr.ScVal.fromXDR(val, "base64");
    } catch {
      return null;
    }
  }
  return val as xdr.ScVal;
}

export function decodeLendingEvent(
  event: RawEventRecord,
  targetUser?: string
): LendingEvent | null {
  try {
    const topicVal = event.topic?.[0];
    if (!topicVal) return null;

    let rawEventName: unknown;
    try {
      const topicScVal = parseScVal(topicVal);
      if (!topicScVal) return null;
      rawEventName = scValToNative(topicScVal);
    } catch {
      return null;
    }

    if (typeof rawEventName !== "string") return null;

    let kind: LendingEventKind | null = null;
    const lower = rawEventName.toLowerCase();
    if (lower === "depositevent" || lower === "deposit") kind = "deposit";
    else if (lower === "withdrawevent" || lower === "withdraw") kind = "withdraw";
    else if (lower === "borrowevent" || lower === "borrow") kind = "borrow";
    else if (lower === "repayevent" || lower === "repay") kind = "repay";

    if (!kind) return null;

    let rawValue: unknown;
    try {
      const valScVal = parseScVal(event.value);
      if (!valScVal) return null;
      rawValue = scValToNative(valScVal);
    } catch {
      return null;
    }

    const data = asRecord(rawValue);
    if (!data) return null;

    // Skip and log unknown schema_version
    if (data.schema_version !== undefined && data.schema_version !== null) {
      const versionNum = Number(data.schema_version);
      if (versionNum !== EVENT_SCHEMA_VERSION) {
        console.warn(`[LendingEvent] Skipping unknown schema_version: ${data.schema_version}`);
        return null;
      }
    }

    const user = extractUserAddress(data.user);
    if (!user) return null;

    if (targetUser) {
      const canonicalTarget = canonicalAddress(targetUser);
      if (canonicalTarget && user !== canonicalTarget) {
        return null;
      }
    }

    const amount = asBigInt(data.amount);
    if (amount === null || amount < BigInt(0)) return null;

    const rawAfter = data.new_balance ?? data.new_debt ?? data.after;
    const after = asBigInt(rawAfter);
    if (after === null || after < BigInt(0)) return null;

    let timestamp: number;
    if (data.timestamp !== undefined && data.timestamp !== null) {
      const rawTs = asBigInt(data.timestamp);
      timestamp = rawTs !== null ? Number(rawTs) : 0;
    } else if (event.ledgerClosedAt) {
      timestamp = Math.floor(new Date(event.ledgerClosedAt).getTime() / 1000);
    } else {
      timestamp = 0;
    }

    return {
      id: event.id ?? `${event.txHash ?? "event"}-${event.ledger ?? 0}`,
      kind,
      user,
      amount,
      after,
      timestamp,
      ledger: event.ledger ?? 0,
      txHash: event.txHash ?? "",
      transactionIndex: event.transactionIndex,
      operationIndex: event.operationIndex,
    };
  } catch (err) {
    console.warn(`[LendingEvent] Failed to decode event ${event?.id}:`, err);
    return null;
  }
}

export function topicFilters(): string[][] {
  return [[
    "AAAADwAAAAxEZXBvc2l0RXZlbnQ=", // ScVal.scvSymbol("DepositEvent")
    "AAAADwAAAA1XaXRoZHJhd0V2ZW50AAAA", // ScVal.scvSymbol("WithdrawEvent")
    "AAAADwAAAAtCb3Jyb3dFdmVudAA=", // ScVal.scvSymbol("BorrowEvent")
    "AAAADwAAAApSZXBheUV2ZW50AAA=", // ScVal.scvSymbol("RepayEvent")
  ]];
}

export function getTxExplorerUrl(txHash: string): string {
  const network = config.network || "testnet";
  return `https://stellar.expert/explorer/${network}/tx/${txHash}`;
}

export function formatLendingAmount(amount: bigint): string {
  const isNegative = amount < BigInt(0);
  const abs = isNegative ? -amount : amount;
  const whole = abs / TOKEN_SCALE;
  const fraction = (abs % TOKEN_SCALE).toString().padStart(7, "0").replace(/0+$/, "");
  const formattedWhole = whole.toLocaleString("en-US");
  const sign = isNegative ? "-" : "";
  return fraction ? `${sign}${formattedWhole}.${fraction}` : `${sign}${formattedWhole}`;
}

export function formatRelativeTime(
  timestampSeconds: number,
  locale: string = "en",
  nowMs: number = Date.now()
): string {
  if (!timestampSeconds || timestampSeconds <= 0) return "-";
  const diffSeconds = Math.floor((nowMs - timestampSeconds * 1000) / 1000);

  try {
    const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
    if (diffSeconds < 60) {
      return rtf.format(-Math.max(1, diffSeconds), "second");
    }
    const diffMinutes = Math.floor(diffSeconds / 60);
    if (diffMinutes < 60) {
      return rtf.format(-diffMinutes, "minute");
    }
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) {
      return rtf.format(-diffHours, "hour");
    }
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 30) {
      return rtf.format(-diffDays, "day");
    }
    const diffMonths = Math.floor(diffDays / 30);
    if (diffMonths < 12) {
      return rtf.format(-diffMonths, "month");
    }
    const diffYears = Math.floor(diffDays / 365);
    return rtf.format(-diffYears, "year");
  } catch {
    const d = new Date(timestampSeconds * 1000);
    return d.toLocaleDateString();
  }
}

export async function getLendingEvents({
  user,
  startLedger,
  cursor,
  limit = DEFAULT_PAGE_SIZE,
  contractId = config.lendingId,
  rpcUrl = config.rpc,
}: GetLendingEventsOptions = {}): Promise<LendingEventsPage> {
  if (!contractId) {
    throw new Error("Lending contract ID is not configured.");
  }

  const server = new rpc.Server(rpcUrl);
  const filters = [{
    type: "contract" as const,
    contractIds: [contractId],
    topics: topicFilters(),
  }];

  let oldestLedger: number | undefined;
  let latestLedger: number | undefined;

  async function resolveHealthAndLatest(): Promise<{
    oldestLedger?: number;
    latestLedger?: number;
  }> {
    try {
      const [health, latest] = await Promise.all([
        server.getHealth(),
        server.getLatestLedger(),
      ]);
      return {
        oldestLedger: health.oldestLedger,
        latestLedger: latest.sequence,
      };
    } catch {
      return {};
    }
  }

  let effectiveStartLedger = startLedger;
  if (!cursor && effectiveStartLedger === undefined) {
    const meta = await resolveHealthAndLatest();
    oldestLedger = meta.oldestLedger;
    latestLedger = meta.latestLedger;
    if (meta.oldestLedger !== undefined) {
      effectiveStartLedger = meta.oldestLedger;
    } else if (meta.latestLedger !== undefined) {
      effectiveStartLedger = Math.max(1, meta.latestLedger - DEFAULT_RETENTION_LEDGERS);
    }
  }

  const buildRequest = (sLedger?: number): rpc.Api.GetEventsRequest => {
    if (cursor) {
      return { filters, cursor, limit };
    }
    return {
      filters,
      startLedger: sLedger ?? 1,
      limit,
    };
  };

  let response: rpc.Api.GetEventsResponse;
  try {
    response = await server.getEvents(buildRequest(effectiveStartLedger));
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    const isRetentionError =
      errMsg.includes("startLedger") ||
      errMsg.includes("retention") ||
      errMsg.includes("oldestLedger") ||
      errMsg.includes("historical");

    if (!cursor && isRetentionError) {
      const meta = await resolveHealthAndLatest();
      oldestLedger = meta.oldestLedger;
      latestLedger = meta.latestLedger;
      if (meta.oldestLedger !== undefined) {
        effectiveStartLedger = meta.oldestLedger;
      } else if (meta.latestLedger !== undefined) {
        effectiveStartLedger = Math.max(1, meta.latestLedger - DEFAULT_RETENTION_LEDGERS);
      }
      response = await server.getEvents(buildRequest(effectiveStartLedger));
    } else {
      throw err;
    }
  }

  const events: LendingEvent[] = [];
  for (const raw of response.events) {
    const decoded = decodeLendingEvent(raw, user);
    if (decoded) {
      events.push(decoded);
    }
  }

  return {
    events,
    cursor: response.cursor,
    hasMore: response.events.length === limit,
    oldestLedger,
    latestLedger,
  };
}
