import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockEvaluateFlag = vi.hoisted(() => vi.fn());

vi.mock('./evaluator', () => ({
  evaluateFlag: mockEvaluateFlag,
}));

async function importRequireFlag() {
  vi.resetModules();
  return import('./requireFlag');
}

describe('requireFlag', () => {
  beforeEach(() => {
    mockEvaluateFlag.mockReset();
  });

  it('allows execution when the evaluated flag is enabled for the user', async () => {
    mockEvaluateFlag.mockReturnValue(true);
    const { requireFlag } = await importRequireFlag();

    expect(() => requireFlag('borrow-flow', 'user-123')).not.toThrow();
    expect(mockEvaluateFlag).toHaveBeenCalledWith('borrow-flow', 'user-123');
  });

  it('blocks execution when the evaluated flag is disabled for the user', async () => {
    mockEvaluateFlag.mockReturnValue(false);
    const { requireFlag } = await importRequireFlag();

    expect(() => requireFlag('borrow-flow', 'user-123')).toThrow(
      "Feature flag 'borrow-flow' is disabled for user 'user-123'.",
    );
    expect(mockEvaluateFlag).toHaveBeenCalledWith('borrow-flow', 'user-123');
  });

  it('treats unknown flags as closed when the evaluator returns false', async () => {
    mockEvaluateFlag.mockReturnValue(false);
    const { requireFlag } = await importRequireFlag();

    expect(() => requireFlag('unknown-flag', 'user-123')).toThrow(
      "Feature flag 'unknown-flag' is disabled for user 'user-123'.",
    );
  });

  it('passes bucketed rollout decisions through without re-evaluating locally', async () => {
    mockEvaluateFlag.mockReturnValue(true);
    const { requireFlag } = await importRequireFlag();

    requireFlag('bucketed-market-preview', 'stable-user-id');

    expect(mockEvaluateFlag).toHaveBeenCalledTimes(1);
    expect(mockEvaluateFlag).toHaveBeenCalledWith('bucketed-market-preview', 'stable-user-id');
  });

  it('propagates evaluator failures instead of defaulting open', async () => {
    mockEvaluateFlag.mockImplementation(() => {
      throw new Error('feature flag config unreadable');
    });
    const { requireFlag } = await importRequireFlag();

    expect(() => requireFlag('borrow-flow', 'user-123')).toThrow(
      'feature flag config unreadable',
    );
  });
});
