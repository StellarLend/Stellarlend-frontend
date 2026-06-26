import { beforeEach, describe, expect, it, vi } from 'vitest';

const sentryMocks = vi.hoisted(() => {
  const init = vi.fn();
  const captureException = vi.fn();
  const scopes: Array<{
    setTag: ReturnType<typeof vi.fn>;
    setContext: ReturnType<typeof vi.fn>;
    setExtra: ReturnType<typeof vi.fn>;
    setUser: ReturnType<typeof vi.fn>;
  }> = [];
  const withScope = vi.fn((callback: (scope: {
    setTag: ReturnType<typeof vi.fn>;
    setContext: ReturnType<typeof vi.fn>;
    setExtra: ReturnType<typeof vi.fn>;
    setUser: ReturnType<typeof vi.fn>;
  }) => void) => {
    const scope = {
      setTag: vi.fn(),
      setContext: vi.fn(),
      setExtra: vi.fn(),
      setUser: vi.fn(),
    };

    scopes.push(scope);
    callback(scope);
  });
  const serverConfig = {
    sentry: {
      dsn: '',
    },
  };

  return {
    captureException,
    init,
    scopes,
    serverConfig,
    withScope,
  };
});

vi.mock('@sentry/nextjs', () => ({
  captureException: sentryMocks.captureException,
  init: sentryMocks.init,
  withScope: sentryMocks.withScope,
}));

vi.mock('@/lib/server-config', () => ({
  default: sentryMocks.serverConfig,
}));

import { captureServerError, initSentry } from './sentry';

describe('Sentry telemetry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sentryMocks.scopes.length = 0;
    sentryMocks.serverConfig.sentry.dsn = '';
    process.env.NEXT_PUBLIC_APP_ENV = 'test';
    process.env.SENTRY_RELEASE = 'test-release';
  });

  it('does not initialize Sentry when no DSN is configured', () => {
    initSentry();

    expect(sentryMocks.init).not.toHaveBeenCalled();
  });

  it('initializes Sentry with the configured DSN, environment, and release', () => {
    sentryMocks.serverConfig.sentry.dsn = 'https://public@example.com/1';
    process.env.NEXT_PUBLIC_APP_ENV = 'staging';
    process.env.SENTRY_RELEASE = 'release-123';

    initSentry();

    expect(sentryMocks.init).toHaveBeenCalledWith({
      dsn: 'https://public@example.com/1',
      environment: 'staging',
      release: 'release-123',
      tracesSampleRate: 0.1,
    });
  });

  it('sets only provided context tags before capturing the exception', () => {
    const error = new Error('partial context');

    captureServerError(error, {
      route: '/api/markets',
      requestId: 'req-123',
    });

    expect(sentryMocks.withScope).toHaveBeenCalledTimes(1);
    expect(sentryMocks.captureException).toHaveBeenCalledWith(error);
    expect(sentryMocks.scopes[0].setTag).toHaveBeenCalledTimes(2);
    expect(sentryMocks.scopes[0].setTag).toHaveBeenCalledWith('route', '/api/markets');
    expect(sentryMocks.scopes[0].setTag).toHaveBeenCalledWith('request_id', 'req-123');
  });

  it('sets route, method, requestId, and sessionId tags for full context', () => {
    captureServerError(new Error('full context'), {
      method: 'POST',
      requestId: 'req-456',
      route: '/api/transactions',
      sessionId: 'sess-789',
    });

    expect(sentryMocks.scopes[0].setTag).toHaveBeenCalledTimes(4);
    expect(sentryMocks.scopes[0].setTag).toHaveBeenCalledWith('route', '/api/transactions');
    expect(sentryMocks.scopes[0].setTag).toHaveBeenCalledWith('method', 'POST');
    expect(sentryMocks.scopes[0].setTag).toHaveBeenCalledWith('request_id', 'req-456');
    expect(sentryMocks.scopes[0].setTag).toHaveBeenCalledWith('session_id', 'sess-789');
  });

  it('does not attach raw secrets or request bodies to the scope', () => {
    captureServerError(new Error('sensitive context'), {
      authorization: 'Bearer secret-token',
      body: { password: 'super-secret' },
      method: 'POST',
      requestId: 'req-safe',
      route: '/api/private',
      sessionId: 'sess-safe',
    } as any);

    const scope = sentryMocks.scopes[0];
    const serializedTags = JSON.stringify(scope.setTag.mock.calls);

    expect(serializedTags).not.toContain('secret-token');
    expect(serializedTags).not.toContain('super-secret');
    expect(scope.setContext).not.toHaveBeenCalled();
    expect(scope.setExtra).not.toHaveBeenCalled();
    expect(scope.setUser).not.toHaveBeenCalled();
  });
});
