import { readPosition } from "@/lib/lending-client";
export { HEALTH_FACTOR_NO_DEBT } from "@/lib/lending-client";

export const I128_MAX = (1n << 127n) - 1n;

export type HealthLevel = "safe" | "warning" | "danger" | "liquidatable";
export type HealthFactorStatus = "ok" | "no-debt" | "very-safe";

export type HealthFactor = {
  value: number | null;
  status: HealthFactorStatus;
};

export type Thresholds = {
  warning: number;
  danger: number;
};

export const DEFAULT_THRESHOLDS: Thresholds = {
  warning: 1.5,
  danger: 1.2,
};

const HEALTH_FACTOR_SCALE = 10_000n;
const NOTIFY_KEY = "stellarlend:health:notifications";
const THRESHOLDS_KEY = "stellarlend:health:thresholds";
const LAST_LEVEL_KEY = "stellarlend:health:last-level";

function safeStorage(): Storage | null {
  try {
    if (typeof window === "undefined") return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

function userStorageKey(prefix: string, user: string): string {
  return `${prefix}:${encodeURIComponent(user.trim().toLowerCase())}`;
}

/** Decode the contract's fixed-point i128 health factor without lossy bigint math. */
export function decodeHealthFactor(raw: bigint): HealthFactor {
  if (raw === HEALTH_FACTOR_NO_DEBT) {
    return { value: null, status: "no-debt" };
  }

  // The contract uses i128::MAX as its overflow / effectively-unbounded sentinel.
  if (raw >= I128_MAX) {
    return { value: null, status: "very-safe" };
  }

  if (raw < 0n) {
    throw new Error("Health factor cannot be negative.");
  }

  const whole = raw / HEALTH_FACTOR_SCALE;
  const fraction = raw % HEALTH_FACTOR_SCALE;
  return {
    value: Number(whole) + Number(fraction) / Number(HEALTH_FACTOR_SCALE),
    status: "ok",
  };
}

/** Format to two decimal places by truncating, never rounding up. */
export function formatHealthFactor(health: HealthFactor): string {
  if (health.status === "no-debt") return "No debt";
  if (health.status === "very-safe") return "Very safe";
  if (health.value === null || !Number.isFinite(health.value)) return "Unavailable";
  const truncated = Math.trunc(health.value * 100) / 100;
  return truncated.toFixed(2);
}

export function validateThresholds(value: unknown): string | null {
  if (typeof value !== "object" || value === null) {
    return "Thresholds must be numbers.";
  }

  const thresholds = value as Partial<Thresholds>;
  if (
    typeof thresholds.warning !== "number" ||
    typeof thresholds.danger !== "number" ||
    !Number.isFinite(thresholds.warning) ||
    !Number.isFinite(thresholds.danger)
  ) {
    return "Thresholds must be finite numbers.";
  }

  if (thresholds.danger <= 1) {
    return "The danger threshold must be above 1.";
  }
  if (thresholds.danger >= thresholds.warning) {
    return "The danger threshold must be lower than the warning threshold.";
  }
  return null;
}

export function classifyHealth(
  health: HealthFactor,
  thresholds: Thresholds,
): HealthLevel {
  if (health.status !== "ok" || health.value === null) return "safe";
  if (health.value >= thresholds.warning) return "safe";
  if (health.value >= thresholds.danger) return "warning";
  if (health.value > 1) return "danger";
  return "liquidatable";
}

/** Higher ranks represent a worsening health state. */
export function rankLevel(level: HealthLevel): number {
  return {
    safe: 0,
    warning: 1,
    danger: 2,
    liquidatable: 3,
  }[level];
}

/** Read the position through the existing lending client / Soroban read path. */
export async function getHealthFactor(user: string): Promise<HealthFactor> {
  if (!user.trim()) throw new Error("A wallet address is required.");
  const position = await readPosition(user);
  return decodeHealthFactor(position.healthFactor);
}

export function loadThresholds(user: string): Thresholds {
  const fallback = { ...DEFAULT_THRESHOLDS };
  try {
    const storage = safeStorage();
    if (!storage) return fallback;
    const raw = storage.getItem(userStorageKey(THRESHOLDS_KEY, user));
    if (!raw) return fallback;
    const parsed: unknown = JSON.parse(raw);
    if (validateThresholds(parsed)) return fallback;
    return {
      warning: (parsed as Thresholds).warning,
      danger: (parsed as Thresholds).danger,
    };
  } catch {
    return fallback;
  }
}

export function saveThresholds(user: string, thresholds: Thresholds): void {
  const error = validateThresholds(thresholds);
  if (error) throw new Error(error);
  try {
    safeStorage()?.setItem(
      userStorageKey(THRESHOLDS_KEY, user),
      JSON.stringify(thresholds),
    );
  } catch {
    // Storage can be disabled or unavailable; monitoring should keep working.
  }
}

export function isNotifyEnabled(): boolean {
  try {
    return safeStorage()?.getItem(NOTIFY_KEY) === "true";
  } catch {
    return false;
  }
}

export function setNotifyEnabled(enabled: boolean): void {
  try {
    const storage = safeStorage();
    if (!storage) return;
    if (enabled) storage.setItem(NOTIFY_KEY, "true");
    else storage.removeItem(NOTIFY_KEY);
  } catch {
    // Notification preferences are optional and must not break the monitor.
  }
}

export function readLastLevel(user: string): HealthLevel | null {
  try {
    const value = safeStorage()?.getItem(userStorageKey(LAST_LEVEL_KEY, user));
    if (
      value === "safe" ||
      value === "warning" ||
      value === "danger" ||
      value === "liquidatable"
    ) {
      return value;
    }
    return null;
  } catch {
    return null;
  }
}

export function writeLastLevel(user: string, level: HealthLevel): void {
  try {
    safeStorage()?.setItem(userStorageKey(LAST_LEVEL_KEY, user), level);
  } catch {
    // Cross-tab notification state is best-effort when storage is unavailable.
  }
}
