// __tests__/flags/evaluator.test.ts
import { describe, it, expect } from 'vitest';
import { evaluateFlag, evaluateAllFlags } from '@/lib/flags/evaluator';
import fs from 'fs';
import path from 'path';

// Helper to reset the config between tests
function loadConfig(json: any) {
  const configPath = path.resolve(process.cwd(), 'config', 'feature-flags.json');
  fs.writeFileSync(configPath, JSON.stringify(json, null, 2));
  // Clear module cache so evaluator reloads the file
  jest.resetModules?.();
}

describe('Feature flag evaluator', () => {
  it('returns false for unknown flag', () => {
    const result = evaluateFlag('nonexistent', 'user1');
    expect(result).toBe(false);
  });

  it('respects enabled false', () => {
    loadConfig({ testFlag: { enabled: false } });
    const result = evaluateFlag('testFlag', 'user1');
    expect(result).toBe(false);
  });

  it('returns true when enabled and no rollout limit', () => {
    loadConfig({ testFlag: { enabled: true } });
    const result = evaluateFlag('testFlag', 'anyUser');
    expect(result).toBe(true);
  });

  it('applies rollout percentage deterministically', () => {
    loadConfig({ rolloutFlag: { enabled: true, rollout: 50 } });
    const userA = evaluateFlag('rolloutFlag', 'userA');
    const userB = evaluateFlag('rolloutFlag', 'userB');
    // Run multiple times to ensure deterministic result
    expect(evaluateFlag('rolloutFlag', 'userA')).toBe(userA);
    expect(evaluateFlag('rolloutFlag', 'userB')).toBe(userB);
  });

  it('honors per‑user overrides', () => {
    loadConfig({ overriddenFlag: { enabled: true, rollout: 0, overrides: { specialUser: true } } });
    const result = evaluateFlag('overriddenFlag', 'specialUser');
    expect(result).toBe(true);
  });

  it('evaluateAllFlags returns map for all defined flags', () => {
    loadConfig({ a: { enabled: true }, b: { enabled: false } });
    const all = evaluateAllFlags('anyUser');
    expect(all).toEqual({ a: true, b: false });
  });
});
