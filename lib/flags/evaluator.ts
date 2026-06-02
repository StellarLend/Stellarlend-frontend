// lib/flags/evaluator.ts
/**
 * Feature flag evaluator.
 * Loads flag definitions from a JSON config file and provides deterministic per‑user bucketing.
 */

import fs from 'fs';
import path from 'path';

export type FlagConfig = {
  enabled: boolean;
  rollout?: number; // 0‑100 percentage of users for which the flag is true
  overrides?: Record<string, boolean>; // userId -> boolean override
};

export type Flags = Record<string, FlagConfig>;

// Load the config once at module initialization.
const CONFIG_PATH = path.resolve(process.cwd(), 'config', 'feature-flags.json');
let flags: Flags = {};
try {
  const raw = fs.readFileSync(CONFIG_PATH, 'utf-8');
  flags = JSON.parse(raw) as Flags;
} catch (e) {
  // If the file does not exist we keep an empty config – the evaluator will simply return false.
  console.warn('Feature flag config not found at', CONFIG_PATH);
}

/** Simple deterministic hash – djb2 algorithm. */
function hashString(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 33) ^ str.charCodeAt(i);
  }
  // Convert to positive 32‑bit integer
  return hash >>> 0;
}

/**
 * Evaluate a single flag for a given user.
 * @param flagKey the key of the flag defined in the config
 * @param userId a stable identifier for the caller (e.g. UUID, email hash)
 * @returns boolean – true if the flag is active for this user
 */
export function evaluateFlag(flagKey: string, userId: string): boolean {
  const flag = flags[flagKey];
  if (!flag) return false;

  // Per‑user override takes precedence.
  if (flag.overrides && Object.prototype.hasOwnProperty.call(flag.overrides, userId)) {
    return !!flag.overrides[userId];
  }

  if (!flag.enabled) return false;

  // If no rollout is defined we treat it as 100%.
  const rollout = typeof flag.rollout === 'number' ? flag.rollout : 100;
  if (rollout >= 100) return true;
  if (rollout <= 0) return false;

  const bucket = hashString(userId + ':' + flagKey) % 100;
  return bucket < rollout;
}

/**
 * Evaluate **all** flags for a user and return a map of flagKey → boolean.
 */
export function evaluateAllFlags(userId: string): Record<string, boolean> {
  const result: Record<string, boolean> = {};
  for (const key of Object.keys(flags)) {
    result[key] = evaluateFlag(key, userId);
  }
  return result;
}
