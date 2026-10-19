import {
  Account,
  Contract,
  TransactionBuilder,
  nativeToScVal,
  rpc,
  scValToNative,
} from "@stellar/stellar-sdk";
import type { xdr } from "@stellar/stellar-sdk";
import { config } from "@/lib/config";

const EVENT_SCHEMA_VERSION = 1;
const EVENT_PAGE_SIZE = 100;
const RECENT_LEDGER_WINDOW = 10_000;
const TOKEN_SCALE = BigInt(10_000_000);
const SIMULATION_SOURCE = "GA5WUJ54Z23KILLCUOUNAKTPBVZWKMQVO4O6EQ5GHLAERIMLLHNCSKYH";

export type FlashActivity =
  | {
      id: string;
      kind: "loan";
      initiator: string;
      receiver: string;
      asset: string;
      amount: bigint;
      fee: bigint;
      feeBps: string | null;
      ledger: number;
      transactionIndex: number;
      operationIndex: number;
      timestamp: string;
      txHash: string;
    }
  | {
      id: string;
      kind: "repayment";
      payer: string;
      asset: string;
      amount: bigint;
      ledger: number;
      transactionIndex: number;
      operationIndex: number;
      timestamp: string;
      txHash: string;
    };

type EventRecord = Pick<
  Awaited<ReturnType<rpc.Server["getEvents"]>>["events"][number],
  "id" | "ledger" | "transactionIndex" | "operationIndex" | "ledgerClosedAt" | "txHash" | "topic" | "value"
>;

export type FlashEventsPage = {
  events: FlashActivity[];
  cursor: string;
  hasMore: boolean;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : null;
}

function asBigInt(value: unknown): bigint | null {
  if (typeof value === "bigint") return value;
  if (typeof value === "number" && Number.isSafeInteger(value)) return BigInt(value);
  if (typeof value === "string" && /^-?\d+$/.test(value)) return BigInt(value);
  return null;
}

function asAddress(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function eventTimestamp(value: unknown, fallback: string): string | null {
  const seconds = asBigInt(value);
  const date = seconds === null ? new Date(fallback) : new Date(Number(seconds) * 1000);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

export function deriveFeeBps(fee: bigint, amount: bigint): string | null {
  if (amount <= BigInt(0) || fee < BigInt(0)) return null;
  const hundredths = (fee * BigInt(1_000_000)) / amount;
  const whole = hundredths / BigInt(100);
  const fraction = (hundredths % BigInt(100)).toString().padStart(2, "0");
  return fraction === "00" ? whole.toString() : `${whole}.${fraction}`;
}

export function decodeFlashEvent(event: EventRecord): FlashActivity | null {
  try {
    const eventName = event.topic[0] ? scValToNative(event.topic[0]) : null;
    const data = asRecord(scValToNative(event.value));
    if (!data || data.schema_version !== EVENT_SCHEMA_VERSION) return null;

    const asset = asAddress(data.asset);
    const amount = asBigInt(data.amount);
    const timestamp = eventTimestamp(data.timestamp, event.ledgerClosedAt);
    if (!asset || amount === null || amount < BigInt(0) || !timestamp) return null;

    if (eventName === "FlashLoanEvent") {
      const initiator = asAddress(data.initiator);
      const receiver = asAddress(data.receiver);
      const fee = asBigInt(data.fee);
      if (!initiator || !receiver || fee === null || fee < BigInt(0)) return null;
      return {
        id: event.id,
        kind: "loan",
        initiator,
        receiver,
        asset,
        amount,
        fee,
        feeBps: deriveFeeBps(fee, amount),
        ledger: event.ledger,
        transactionIndex: event.transactionIndex,
        operationIndex: event.operationIndex,
        timestamp,
        txHash: event.txHash,
      };
    }

    if (eventName === "FlashLoanRepaidEvent") {
      const payer = asAddress(data.payer);
      if (!payer) return null;
      return {
        id: event.id,
        kind: "repayment",
        payer,
        asset,
        amount,
        ledger: event.ledger,
        transactionIndex: event.transactionIndex,
        operationIndex: event.operationIndex,
        timestamp,
        txHash: event.txHash,
      };
    }
  } catch {
    return null;
  }

  return null;
}

function getServer(): rpc.Server {
  if (!config.lendingId) {
    throw new Error("Set NEXT_PUBLIC_LENDING_CONTRACT_ID to load flash-loan activity.");
  }
  return new rpc.Server(config.rpc);
}

function topicFilter(): string[][] {
  // Contract events publish the event name as a Symbol topic; RPC filters use the Symbol's ScVal XDR.
  return [[
    nativeToScVal("FlashLoanEvent", { type: "symbol" }).toXDR("base64"),
    nativeToScVal("FlashLoanRepaidEvent", { type: "symbol" }).toXDR("base64"),
  ]];
}

export async function fetchFlashEvents(cursor?: string): Promise<FlashEventsPage> {
  const server = getServer();
  const filters = [{ type: "contract" as const, contractIds: [config.lendingId], topics: topicFilter() }];
  const request = cursor
    ? { filters, cursor, limit: EVENT_PAGE_SIZE }
    : await (async () => {
        const [health, latest] = await Promise.all([server.getHealth(), server.getLatestLedger()]);
        const startLedger = Math.max(health.oldestLedger, latest.sequence - RECENT_LEDGER_WINDOW);
        return { filters, startLedger, endLedger: latest.sequence, limit: EVENT_PAGE_SIZE };
      })();
  const response = await server.getEvents(request);
  const events = response.events
    .map(decodeFlashEvent)
    .filter((event): event is FlashActivity => event !== null);

  return {
    events,
    cursor: response.cursor,
    hasMore: response.events.length === EVENT_PAGE_SIZE,
  };
}

async function readContract(method: string, ...args: xdr.ScVal[]) {
  const server = getServer();
  const networkPassphrase = (await server.getNetwork()).passphrase;
  const transaction = new TransactionBuilder(new Account(SIMULATION_SOURCE, "0"), {
    fee: "100",
    networkPassphrase,
  })
    .addOperation(new Contract(config.lendingId).call(method, ...args))
    .setTimeout(30)
    .build();
  const result = await server.simulateTransaction(transaction);

  if (rpc.Api.isSimulationError(result)) {
    throw new Error(`Could not read ${method}: ${result.error}`);
  }
  if (!result.result) {
    throw new Error(`Could not read ${method}: the RPC returned no result.`);
  }
  return scValToNative(result.result.retval);
}

export async function fetchFlashLoanParams(): Promise<{ maxFlashBps: bigint; paused: boolean }> {
  const [maxFlashBpsValue, pausedValue] = await Promise.all([
    readContract("get_max_flash_bps"),
    readContract("get_pause_state", nativeToScVal(["FlashLoan"], { type: ["symbol"] })),
  ]);
  const maxFlashBps = asBigInt(maxFlashBpsValue);
  if (maxFlashBps === null || maxFlashBps < BigInt(0) || maxFlashBps > BigInt(10_000)) {
    throw new Error("The lending contract returned an invalid maximum flash-loan utilization.");
  }
  if (typeof pausedValue !== "boolean") {
    throw new Error("The lending contract returned an invalid flash-loan pause state.");
  }
  return { maxFlashBps, paused: pausedValue };
}

export function formatTokenAmount(amount: bigint): string {
  const whole = amount / TOKEN_SCALE;
  const fraction = (amount % TOKEN_SCALE).toString().padStart(7, "0").replace(/0+$/, "");
  return fraction ? `${whole.toLocaleString("en-US")}.${fraction}` : whole.toLocaleString("en-US");
}

export function formatUtilization(bps: bigint): string {
  const whole = bps / BigInt(100);
  const fraction = (bps % BigInt(100)).toString().padStart(2, "0").replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}%` : `${whole}%`;
}
