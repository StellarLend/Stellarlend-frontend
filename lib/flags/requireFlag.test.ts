import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { requireFlag } from './requireFlag';
import * as evaluator from './evaluator';

/**
 * Unit tests for lib/flags/requireFlag.ts (GrantFox #676).
 *
 * requireFlag is a thin enforcement wrapper around evaluateFlag:
 * - enabled → silent pass
 * - disabled / unknown / rollout-miss → throws a stable Error message
 * It does not implement bucketing itself; bucketed flags are covered by
 * asserting that evaluateFlag's boolean is honoured (mock or real).
 */
describe('requireFlag', () => {
  beforeEach(() => {
    vi.spyOn(evaluator, 'evaluateFlag');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('passes silently for an enabled flag', () => {
    vi.mocked(evaluator.evaluateFlag).mockReturnValue(true);
    expect(() => requireFlag('test-flag', 'user-123')).not.toThrow();
    expect(evaluator.evaluateFlag).toHaveBeenCalledWith('test-flag', 'user-123');
  });

  it('throws an error with correct message for a disabled flag', () => {
    vi.mocked(evaluator.evaluateFlag).mockReturnValue(false);
    expect(() => requireFlag('disabled-flag', 'user-456')).toThrowError(
      "Feature flag 'disabled-flag' is disabled for user 'user-456'.",
    );
    expect(evaluator.evaluateFlag).toHaveBeenCalledWith('disabled-flag', 'user-456');
  });

  it('blocks unknown flags (safe-closed default via evaluateFlag false)', () => {
    // evaluateFlag returns false when the flag key is missing from config.
    vi.mocked(evaluator.evaluateFlag).mockReturnValue(false);
    expect(() => requireFlag('does-not-exist', 'user-789')).toThrow(
      /Feature flag 'does-not-exist' is disabled for user 'user-789'/,
    );
  });

  it('honours per-user bucketed rollout decisions from the evaluator', () => {
    // requireFlag does not re-implement rollout math; it trusts evaluateFlag.
    // Simulate user A in rollout bucket (true) and user B outside (false).
    vi.mocked(evaluator.evaluateFlag).mockImplementation((flag, userId) => {
      if (flag !== 'partial-rollout') return false;
      return userId === 'in-bucket-user';
    });

    expect(() => requireFlag('partial-rollout', 'in-bucket-user')).not.toThrow();
    expect(() => requireFlag('partial-rollout', 'out-of-bucket-user')).toThrow(
      /Feature flag 'partial-rollout' is disabled for user 'out-of-bucket-user'/,
    );
  });

  it('propagates evaluator errors without swallowing them', () => {
    vi.mocked(evaluator.evaluateFlag).mockImplementation(() => {
      throw new Error('flags config unreadable');
    });

    expect(() => requireFlag('any-flag', 'user-1')).toThrow('flags config unreadable');
  });

  it('includes both flag key and user id in the disabled error message', () => {
    vi.mocked(evaluator.evaluateFlag).mockReturnValue(false);
    try {
      requireFlag('beta-markets', 'GABC…XYZ');
      expect.fail('expected throw');
    } catch (err) {
      expect(err).toBeInstanceOf(Error);
      const message = (err as Error).message;
      expect(message).toContain('beta-markets');
      expect(message).toContain('GABC…XYZ');
      expect(message).toMatch(/^Feature flag '/);
    }
  });
});
