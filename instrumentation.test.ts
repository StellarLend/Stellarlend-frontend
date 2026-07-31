import { beforeEach, describe, expect, it, vi } from 'vitest';

const initSentry = vi.fn();
vi.mock('@/lib/telemetry/sentry', () => ({ initSentry }));

describe('instrumentation register', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.NEXT_RUNTIME = 'nodejs';
  });

  it('logs an unexpected Sentry initialization error', async () => {
    const error = new Error('invalid Sentry configuration');
    initSentry.mockImplementationOnce(() => { throw error; });
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const { register } = await import('./instrumentation');
    await register();

    expect(consoleError).toHaveBeenCalledWith('Failed to initialize Sentry', error);
  });
});
