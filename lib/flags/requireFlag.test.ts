import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { requireFlag } from './requireFlag';
import * as evaluator from './evaluator';

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
      "Feature flag 'disabled-flag' is disabled for user 'user-456'."
    );
    expect(evaluator.evaluateFlag).toHaveBeenCalledWith('disabled-flag', 'user-456');
  });
});
