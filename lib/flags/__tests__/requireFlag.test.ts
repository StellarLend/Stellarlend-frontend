import * as evaluator from '../evaluator';
import { requireFlag } from '../requireFlag';

jest.mock('../evaluator');
const mockEvaluate = evaluator.evaluateFlag as jest.MockedFunction<typeof evaluator.evaluateFlag>;

beforeEach(() => {
  mockEvaluate.mockReset();
});

describe('requireFlag', () => {
  it('does not throw when the flag evaluates to true', () => {
    mockEvaluate.mockReturnValue(true);
    expect(() => requireFlag('new-borrow-flow', 'user-1')).not.toThrow();
    expect(mockEvaluate).toHaveBeenCalledWith('new-borrow-flow', 'user-1');
  });

  it('throws an Error when the flag evaluates to false', () => {
    mockEvaluate.mockReturnValue(false);
    expect(() => requireFlag('new-borrow-flow', 'user-1')).toThrow(
      "Feature flag 'new-borrow-flow' is disabled for user 'user-1'.",
    );
  });

  it('throws an Error (not a custom subclass) so callers can catch via base class', () => {
    mockEvaluate.mockReturnValue(false);
    try {
      requireFlag('disabled-flag', 'user-2');
      fail('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(Error);
      expect((e as Error).message).toContain('disabled-flag');
      expect((e as Error).message).toContain('user-2');
    }
  });

  it('passes flagKey and userId through to evaluateFlag unchanged', () => {
    mockEvaluate.mockReturnValue(true);
    requireFlag('flag.with.dots', 'user-id-with-special-chars@x');
    expect(mockEvaluate).toHaveBeenCalledWith('flag.with.dots', 'user-id-with-special-chars@x');
  });
});
