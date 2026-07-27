// lib/flags/requireFlag.ts
/**
 * Helper to assert that a feature flag is enabled.
 * Throws an error when the flag is disabled for the given user.
 */
import { evaluateFlag } from './evaluator';

export function requireFlag(flagKey: string, userId: string): void {
  if (!evaluateFlag(flagKey, userId)) {
    throw new Error(`Feature flag '${flagKey}' is disabled for user '${userId}'.`);
  }
}
