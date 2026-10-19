import { config } from "@/lib/config";

export type BadDebtWriteOffEvent = {
  amount: bigint;
  insuranceUsed: bigint;
  reserveUsed: bigint;
  socialized: bigint;
  timestamp?: string;
};

export type SolvencyMetrics = {
  insuranceFund: bigint;
  insuranceShareBps: bigint;
  badDebt: bigint;
  totalSupply: bigint;
  coverageRatio: number;
  coverageLabel: string;
  insuranceFundDisplay: string;
  badDebtDisplay: string;
  insuranceShareDisplay: string;
};

const TOKEN_DECIMALS = 10n ** 7n;
const BPS_SCALE = 10_000n;

const toBigInt = (value: unknown): bigint => {
  if (typeof value === "bigint") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("Received non-finite number");
    return BigInt(Math.trunc(value));
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) throw new Error("Received empty value");
    return BigInt(trimmed);
  }
  throw new Error("Unsupported bigint value");
};

const toMaybeBigInt = (value: unknown): bigint | null => {
  if (value === undefined || value === null || value === "") return null;
  try {
    return toBigInt(value);
  } catch {
    return null;
  }
};

export function formatTokenAmount(value: bigint, decimals = 7): string {
  const normalized = value < 0n ? -value : value;
  const whole = normalized / TOKEN_DECIMALS;
  const fraction = normalized % TOKEN_DECIMALS;
  const fractionString = fraction.toString().padStart(7, "0").slice(0, decimals);
  const sign = value < 0n ? "-" : "";
  return `${sign}${whole}.${fractionString}`;
}

export function formatUsdAmount(value: bigint): string {
  return `$${formatTokenAmount(value)}`;
}

export function formatPercentFromBps(bps: bigint): string {
  const normalized = Number(bps) / Number(BPS_SCALE);
  return `${(normalized * 100).toFixed(2)}%`;
}

export function calculateCoverageRatio(insuranceFund: bigint, badDebt: bigint) {
  if (badDebt <= 0n) {
    return { label: "Fully covered", ratio: 1 };
  }

  if (insuranceFund <= 0n) {
    return { label: "0.00%", ratio: 0 };
  }

  const ratio = Number(insuranceFund) / Number(badDebt);
  return { label: `${(ratio * 100).toFixed(2)}%`, ratio };
}

export function calculateInsuranceShare(insuranceFund: bigint, totalSupply: bigint): bigint {
  if (totalSupply <= 0n) return 0n;
  return (insuranceFund * BPS_SCALE) / totalSupply;
}

export function decodeBadDebtWriteOffEvent(raw: unknown): BadDebtWriteOffEvent | null {
  if (!raw || typeof raw !== "object") return null;

  const candidate = raw as Record<string, unknown>;

  const amount = toMaybeBigInt(candidate.amount);
  const insuranceUsed = toMaybeBigInt(candidate.insurance_used ?? candidate.insuranceUsed);
  const reserveUsed = toMaybeBigInt(candidate.reserve_used ?? candidate.reserveUsed);
  const socialized = toMaybeBigInt(candidate.socialized ?? candidate.socializedValue);

  if (amount === null || insuranceUsed === null || reserveUsed === null || socialized === null) {
    return null;
  }

  if (insuranceUsed + reserveUsed + socialized !== amount) {
    return null;
  }

  return {
    amount,
    insuranceUsed,
    reserveUsed,
    socialized,
    timestamp: typeof candidate.timestamp === "string" ? candidate.timestamp : undefined,
  };
}

export function getDefaultSolvencyMetrics(): SolvencyMetrics {
  return {
    insuranceFund: 0n,
    insuranceShareBps: 0n,
    badDebt: 0n,
    totalSupply: 0n,
    coverageRatio: 1,
    coverageLabel: "Fully covered",
    insuranceFundDisplay: "$0.000000",
    badDebtDisplay: "$0.000000",
    insuranceShareDisplay: "0.00%",
  };
}

export function buildSolvencyMetrics(insuranceFund: bigint, insuranceShareBps: bigint, badDebt: bigint, totalSupply: bigint): SolvencyMetrics {
  const coverage = calculateCoverageRatio(insuranceFund, badDebt);
  const share = calculateInsuranceShare(insuranceFund, totalSupply);

  return {
    insuranceFund,
    insuranceShareBps: insuranceShareBps > 0n ? insuranceShareBps : share,
    badDebt,
    totalSupply,
    coverageRatio: coverage.ratio,
    coverageLabel: coverage.label,
    insuranceFundDisplay: formatUsdAmount(insuranceFund),
    badDebtDisplay: formatUsdAmount(badDebt),
    insuranceShareDisplay: formatPercentFromBps(insuranceShareBps > 0n ? insuranceShareBps : share),
  };
}

async function readContractValue(contractId: string, method: string, rpcUrl: string): Promise<unknown> {
  const response = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "simulateTransaction",
      params: [{
        contractId,
        method,
        args: [],
      }],
    }),
  });

  if (!response.ok) {
    throw new Error(`Solvency RPC call failed for ${method}: ${response.status}`);
  }

  const payload = (await response.json()) as { result?: { retval?: unknown; value?: unknown; }, error?: { message?: string } };
  if (payload.error) {
    throw new Error(payload.error.message ?? `RPC error for ${method}`);
  }

  return payload.result?.retval ?? payload.result?.value ?? payload.result ?? null;
}

export async function readBadDebtWrittenOffEvents(contractId: string, rpcUrl: string): Promise<BadDebtWriteOffEvent[]> {
  const response = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "getEvents",
      params: {
        contractId,
        eventType: "BadDebtWrittenOffEvent",
        limit: 10,
      },
    }),
  });

  if (!response.ok) {
    return [];
  }

  const payload = (await response.json()) as { events?: Array<Record<string, unknown>> };
  const records = payload.events ?? [];
  return records
    .map((event) => {
      const value = event.value ?? event;
      const decoded = decodeBadDebtWriteOffEvent(value);
      return decoded;
    })
    .filter((event): event is BadDebtWriteOffEvent => event !== null)
    .slice(0, 10);
}

export async function readProtocolSolvency(options?: { contractId?: string; rpcUrl?: string }): Promise<{ metrics: SolvencyMetrics; writeOffs: BadDebtWriteOffEvent[] }> {
  const contractId = options?.contractId ?? config.lendingId;
  const rpcUrl = options?.rpcUrl ?? config.rpc;

  if (!contractId || !rpcUrl) {
    return { metrics: getDefaultSolvencyMetrics(), writeOffs: [] };
  }

  const results = await Promise.allSettled([
    readContractValue(contractId, "get_insurance_fund", rpcUrl),
    readContractValue(contractId, "get_bad_debt", rpcUrl),
    readContractValue(contractId, "get_insurance_share", rpcUrl),
    readContractValue(contractId, "get_protocol_metrics", rpcUrl),
  ]);

  const insuranceFundResult = results[0].status === "fulfilled" ? toMaybeBigInt(results[0].value) : null;
  const badDebtResult = results[1].status === "fulfilled" ? toMaybeBigInt(results[1].value) : null;
  const insuranceShareResult = results[2].status === "fulfilled" ? toMaybeBigInt(results[2].value) : null;
  const protocolMetrics = results[3].status === "fulfilled" ? results[3].value : null;

  const fallbackAmount = protocolMetrics && typeof protocolMetrics === "object"
    ? toMaybeBigInt((protocolMetrics as Record<string, unknown>).total_supply ?? (protocolMetrics as Record<string, unknown>).totalSupply)
    : null;

  const insuranceFund = insuranceFundResult ?? 0n;
  const badDebt = badDebtResult ?? 0n;
  const insuranceShareBps = insuranceShareResult ?? 0n;
  const totalSupply = fallbackAmount ?? 0n;

  const events = await readBadDebtWrittenOffEvents(contractId, rpcUrl).catch(() => []);

  return {
    metrics: buildSolvencyMetrics(insuranceFund, insuranceShareBps, badDebt, totalSupply),
    writeOffs: events,
  };
}
