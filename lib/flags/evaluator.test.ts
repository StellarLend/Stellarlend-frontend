import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getFlags, evaluateFlag, evaluateAllFlags } from './evaluator';
import fs from 'fs';
import path from 'path';

vi.mock('fs');

const CONFIG_PATH = path.resolve(process.cwd(), 'config', 'feature-flags.json');

describe('getFlags', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.mocked(fs.readFileSync).mockReset();
    // Simulate test environment so getFlags() always re-reads
    vi.stubEnv('NODE_ENV', 'test');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('returns parsed flags from config file', () => {
    const mockFlags = { 'my-flag': { enabled: true, rollout: 50 } };
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(mockFlags));
    const flags = getFlags();
    expect(flags).toEqual(mockFlags);
    expect(fs.readFileSync).toHaveBeenCalledWith(CONFIG_PATH, 'utf-8');
  });

  it('returns empty object when config file is missing', () => {
    vi.mocked(fs.readFileSync).mockImplementation(() => { throw new Error('ENOENT'); });
    const flags = getFlags();
    expect(flags).toEqual({});
  });

  it('returns empty object when config file contains invalid JSON', () => {
    vi.mocked(fs.readFileSync).mockReturnValue('not-json');
    const flags = getFlags();
    expect(flags).toEqual({});
  });
});

describe('evaluateFlag', () => {
  beforeEach(() => {
    vi.stubEnv('NODE_ENV', 'test');
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({
      'test-flag': { enabled: true, rollout: 50 },
      'disabled-flag': { enabled: false },
      'full-rollout': { enabled: true },
      'overridden-flag': { enabled: false, overrides: { 'user-1': true } },
    }));
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('returns false for unknown flag', () => {
    expect(evaluateFlag('unknown', 'user-1')).toBe(false);
  });

  it('returns false for disabled flag', () => {
    expect(evaluateFlag('disabled-flag', 'user-1')).toBe(false);
  });

  it('returns true for fully rolled out flag', () => {
    expect(evaluateFlag('full-rollout', 'user-1')).toBe(true);
  });

  it('returns true for user override even when flag is disabled', () => {
    expect(evaluateFlag('overridden-flag', 'user-1')).toBe(true);
  });

  it('returns false for overridden user when override is false', () => {
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({
      'flag': { enabled: true, overrides: { 'user-1': false } },
    }));
    expect(evaluateFlag('flag', 'user-1')).toBe(false);
  });

  it('uses deterministic bucketing for rollout', () => {
    // Same user+flag always gets same result
    const result1 = evaluateFlag('test-flag', 'user-123');
    const result2 = evaluateFlag('test-flag', 'user-123');
    expect(result1).toBe(result2);
  });

  it('returns false for 0 percent rollout', () => {
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({
      'zero-flag': { enabled: true, rollout: 0 },
    }));
    expect(evaluateFlag('zero-flag', 'user-1')).toBe(false);
  });
});

describe('evaluateAllFlags', () => {
  beforeEach(() => {
    vi.stubEnv('NODE_ENV', 'test');
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({
      'flag-a': { enabled: true },
      'flag-b': { enabled: false },
    }));
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('returns a map of all flags for a user', () => {
    const result = evaluateAllFlags('user-1');
    expect(result).toHaveProperty('flag-a', true);
    expect(result).toHaveProperty('flag-b', false);
  });
});

describe('getFlags TTL-based hot reload', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.mocked(fs.readFileSync).mockReset();
    // Simulate production environment
    vi.stubEnv('NODE_ENV', 'production');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('picks up config changes without process restart', async () => {
    // Dynamically re-import to get fresh module state
    const evaluator = await import('./evaluator');

    // First read: flag is disabled
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({
      'my-flag': { enabled: false },
    }));
    const firstResult = evaluator.evaluateFlag('my-flag', 'user-1');
    expect(firstResult).toBe(false);

    // Change config: enable the flag
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({
      'my-flag': { enabled: true },
    }));

    // Force TTL expiry by advancing time
    vi.advanceTimersByTime(61_000);

    // Second read should pick up the change
    const secondResult = evaluator.evaluateFlag('my-flag', 'user-1');
    expect(secondResult).toBe(true);

    vi.useRealTimers();
  });
});
