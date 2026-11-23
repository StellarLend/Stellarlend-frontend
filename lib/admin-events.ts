import {
  Address,
  rpc,
  scValToNative,
  xdr,
} from "@stellar/stellar-sdk";
import { config } from "@/lib/config";
import {
  type PauseType,
  type EmergencyState,
  PAUSE_TYPES,
  EMERGENCY_STATES,
  SECONDS_PER_LEDGER,
} from "@/lib/admin";
import type { RawEventRecord } from "@/lib/events";

export type AdminEventKind =
  | "pause_set"
  | "pause_unset"
  | "emergency_state_set"
  | "admin_set"
  | "guardian_set";

export interface AdminEvent {
  id: string;
  kind: AdminEventKind;
  action: string;
  actor: string;
  ledger: number;
  timestamp?: number;
  txHash: string;
  pauseType?: PauseType;
  enabled?: boolean;
  expiresAtLedger?: number;
  remainingSeconds?: number;
  isExpired?: boolean;
  emergencyState?: EmergencyState;
  newAdmin?: string;
  newGuardian?: string;
}

export interface AdminEventsPage {
  events: AdminEvent[];
  cursor: string;
  hasMore: boolean;
}

export interface GetAdminEventsOptions {
  contractId?: string;
  rpcUrl?: string;
  startLedger?: number;
  cursor?: string;
  limit?: number;
  currentLedger?: number;
}

function parseScValNative(val: unknown): unknown {
  if (!val) return null;
  if (typeof val === "object" && val !== null && "switch" in val) {
    try {
      return scValToNative(val as xdr.ScVal);
    } catch {
      return null;
    }
  }
  return val;
}

export function decodeAdminEvent(
  raw: RawEventRecord,
  currentLedger?: number,
): AdminEvent | null {
  try {
    if (!raw || !Array.isArray(raw.topic) || raw.topic.length === 0) {
      return null;
    }

    const topic0 = parseScValNative(raw.topic[0]);
    const topic0Str = String(topic0 || "").toLowerCase();

    const id = raw.id ?? `event-${raw.ledger ?? 0}-${raw.txHash ?? ""}`;
    const ledger = raw.ledger ?? 0;
    const txHash = raw.txHash ?? "";
    const timestamp = raw.ledgerClosedAt
      ? Math.floor(new Date(raw.ledgerClosedAt).getTime() / 1000)
      : undefined;

    const valueNative = parseScValNative(raw.value);
    const valueObj =
      typeof valueNative === "object" && valueNative !== null
        ? (valueNative as Record<string, unknown>)
        : {};

    const nowLedger = currentLedger ?? ledger;

    // 1. Pause events: set_pause, pause_set, pause
    if (
      topic0Str === "set_pause" ||
      topic0Str === "pause_set" ||
      topic0Str === "pause"
    ) {
      const topic1 = parseScValNative(raw.topic[1]);
      let pauseTypeStr = typeof topic1 === "string" ? topic1 : "";
      if (!pauseTypeStr && typeof valueObj.pause_type === "string") {
        pauseTypeStr = valueObj.pause_type;
      }
      if (!pauseTypeStr && typeof valueObj.pauseType === "string") {
        pauseTypeStr = valueObj.pauseType;
      }

      const matchedType = PAUSE_TYPES.find(
        (p) => p.toLowerCase() === pauseTypeStr.toLowerCase(),
      ) ?? "All";

      const enabled =
        typeof valueObj.enabled === "boolean"
          ? valueObj.enabled
          : typeof valueObj.paused === "boolean"
          ? valueObj.paused
          : true;

      const actor =
        typeof valueObj.actor === "string"
          ? valueObj.actor
          : typeof valueObj.caller === "string"
          ? valueObj.caller
          : typeof parseScValNative(raw.topic[2]) === "string"
          ? String(parseScValNative(raw.topic[2]))
          : "GADMIN";

      const rawExpiry =
        valueObj.expires_at_ledger ??
        valueObj.expiresAtLedger ??
        valueObj.expires_at;
      const expiresAtLedger =
        typeof rawExpiry === "number"
          ? rawExpiry
          : typeof rawExpiry === "bigint"
          ? Number(rawExpiry)
          : undefined;

      let remainingSeconds: number | undefined;
      let isExpired: boolean | undefined;

      if (expiresAtLedger !== undefined && expiresAtLedger > 0) {
        isExpired = nowLedger >= expiresAtLedger;
        remainingSeconds = isExpired
          ? 0
          : (expiresAtLedger - nowLedger) * SECONDS_PER_LEDGER;
      }

      return {
        id,
        kind: enabled ? "pause_set" : "pause_unset",
        action: enabled ? `Pause ${matchedType}` : `Unpause ${matchedType}`,
        actor,
        ledger,
        timestamp,
        txHash,
        pauseType: matchedType,
        enabled,
        expiresAtLedger,
        remainingSeconds,
        isExpired,
      };
    }

    // 2. Emergency state: set_emergency_state, emergency_state_set
    if (
      topic0Str === "set_emergency_state" ||
      topic0Str === "emergency_state_set"
    ) {
      let stateStr = "";
      const topic1 = parseScValNative(raw.topic[1]);
      if (typeof topic1 === "string") stateStr = topic1;
      if (!stateStr && typeof valueObj.state === "string") stateStr = valueObj.state;

      const matchedState = EMERGENCY_STATES.find(
        (s) => s.toLowerCase() === stateStr.toLowerCase(),
      ) ?? "Normal";

      const actor =
        typeof valueObj.actor === "string"
          ? valueObj.actor
          : typeof parseScValNative(raw.topic[2]) === "string"
          ? String(parseScValNative(raw.topic[2]))
          : "GADMIN";

      return {
        id,
        kind: "emergency_state_set",
        action: `Emergency State: ${matchedState}`,
        actor,
        ledger,
        timestamp,
        txHash,
        emergencyState: matchedState,
      };
    }

    // 3. Admin changed: set_admin, admin_set
    if (topic0Str === "set_admin" || topic0Str === "admin_set") {
      const newAdmin =
        typeof valueObj.new_admin === "string"
          ? valueObj.new_admin
          : typeof parseScValNative(raw.topic[1]) === "string"
          ? String(parseScValNative(raw.topic[1]))
          : "GNEWADMIN";

      const actor =
        typeof valueObj.actor === "string"
          ? valueObj.actor
          : typeof parseScValNative(raw.topic[2]) === "string"
          ? String(parseScValNative(raw.topic[2]))
          : "GADMIN";

      return {
        id,
        kind: "admin_set",
        action: "Admin Updated",
        actor,
        ledger,
        timestamp,
        txHash,
        newAdmin,
      };
    }

    // 4. Guardian changed: set_guardian, guardian_set
    if (topic0Str === "set_guardian" || topic0Str === "guardian_set") {
      const newGuardian =
        typeof valueObj.new_guardian === "string"
          ? valueObj.new_guardian
          : typeof parseScValNative(raw.topic[1]) === "string"
          ? String(parseScValNative(raw.topic[1]))
          : "GNEWGUARDIAN";

      const actor =
        typeof valueObj.actor === "string"
          ? valueObj.actor
          : typeof parseScValNative(raw.topic[2]) === "string"
          ? String(parseScValNative(raw.topic[2]))
          : "GADMIN";

      return {
        id,
        kind: "guardian_set",
        action: "Guardian Updated",
        actor,
        ledger,
        timestamp,
        txHash,
        newGuardian,
      };
    }

    // Unknown topic — return null without throwing
    return null;
  } catch {
    return null;
  }
}

export async function getAdminEvents(
  options: GetAdminEventsOptions = {},
): Promise<AdminEventsPage> {
  const contractId = options.contractId || config.lendingId;
  const rpcUrl = options.rpcUrl || config.rpc;
  const limit = options.limit || 20;

  if (!contractId || !rpcUrl) {
    return { events: [], cursor: "", hasMore: false };
  }

  const server = new rpc.Server(rpcUrl);
  const startLedger = options.startLedger ?? 1;

  const response = await server.getEvents({
    startLedger,
    cursor: options.cursor,
    limit,
    filters: [
      {
        type: "contract",
        contractIds: [contractId],
      },
    ],
  });

  const rawEvents = (response?.events ?? []) as RawEventRecord[];
  const currentLedger = options.currentLedger;

  const events: AdminEvent[] = [];
  for (const raw of rawEvents) {
    const decoded = decodeAdminEvent(raw, currentLedger);
    if (decoded) {
      events.push(decoded);
    }
  }

  const cursor = response?.cursor ?? "";
  const hasMore = rawEvents.length >= limit;

  return {
    events,
    cursor,
    hasMore,
  };
}
