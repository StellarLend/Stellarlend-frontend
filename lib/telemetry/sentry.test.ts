import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock scope object with methods used in captureServerError
const mockScope = {
  setTag: vi.fn(),
};

// Mock @sentry/nextjs
vi.mock('@sentry/nextjs', () => ({
  init: vi.fn(),
  withScope: vi.fn((callback) => callback(mockScope)),
  captureException: vi.fn(),
}));

// Mock server-only module
vi.mock('server-only', () => ({}));

// Mock @/lib/server-config
vi.mock('@/lib/server-config', () => ({
  default: {
    sentry: {
      dsn: undefined, // default: no DSN
    },
  },
}));

// Import actual functions under test
import { initSentry, captureServerError } from './sentry';
import * as Sentry from '@sentry/nextjs';
import serverConfig from '@/lib/server-config';

beforeEach(() => {
  vi.clearAllMocks();
  mockScope.setTag.mockClear();
});

// SUITE 1: initSentry — no-DSN guard
describe('initSentry — no-DSN guard', () => {
  it('does NOT call Sentry.init when DSN is undefined', () => {
    // serverConfig.sentry.dsn = undefined (default from mock)
    initSentry();
    expect(Sentry.init).not.toHaveBeenCalled();
  });

  it('does NOT call Sentry.init when DSN is empty string', () => {
    vi.mocked(serverConfig.sentry).dsn = '';
    initSentry();
    expect(Sentry.init).not.toHaveBeenCalled();
  });

  it('calls Sentry.init with correct config when DSN is present', () => {
    vi.mocked(serverConfig.sentry).dsn = 'https://abc@sentry.io/123';
    initSentry();
    expect(Sentry.init).toHaveBeenCalledWith(
      expect.objectContaining({
        dsn: 'https://abc@sentry.io/123',
        environment: expect.any(String),
        release: expect.any(String),
        tracesSampleRate: 0.1,
      })
    );
  });
});

// SUITE 2: captureServerError — scope tagging
describe('captureServerError — scope tagging', () => {
  it('sets route tag when route is provided', () => {
    captureServerError(new Error('test'), { route: '/api/loans' });
    expect(mockScope.setTag).toHaveBeenCalledWith('route', '/api/loans');
  });

  it('sets method tag when method is provided', () => {
    captureServerError(new Error('test'), { method: 'POST' });
    expect(mockScope.setTag).toHaveBeenCalledWith('method', 'POST');
  });

  it('sets requestId tag when requestId is provided', () => {
    captureServerError(new Error('test'), { requestId: 'req-123' });
    expect(mockScope.setTag).toHaveBeenCalledWith('request_id', 'req-123');
  });

  it('sets sessionId tag when sessionId is provided', () => {
    captureServerError(new Error('test'), { sessionId: 'sess-456' });
    expect(mockScope.setTag).toHaveBeenCalledWith('session_id', 'sess-456');
  });

  it('sets all tags when full context provided', () => {
    captureServerError(new Error('test'), {
      route: '/api/loans',
      method: 'POST',
      requestId: 'req-123',
      sessionId: 'sess-456',
    });
    expect(mockScope.setTag).toHaveBeenCalledWith('route', '/api/loans');
    expect(mockScope.setTag).toHaveBeenCalledWith('method', 'POST');
    expect(mockScope.setTag).toHaveBeenCalledWith('request_id', 'req-123');
    expect(mockScope.setTag).toHaveBeenCalledWith('session_id', 'sess-456');
  });

  it('does not set tags for undefined context fields', () => {
    captureServerError(new Error('test'), { route: '/api/loans' });
    // method/requestId/sessionId not provided — should not be tagged
    const tagCalls = mockScope.setTag.mock.calls.map((c) => c[0]);
    expect(tagCalls).not.toContain('method');
    expect(tagCalls).not.toContain('request_id');
    expect(tagCalls).not.toContain('session_id');
  });
});

// SUITE 3: captureServerError — no secrets leaked
describe('captureServerError — no secret leakage', () => {
  it('does not set body as a tag (body not in context schema)', () => {
    captureServerError(new Error('test'), {
      route: '/api/loans',
      // @ts-expect-error testing invalid context
      body: '{"password":"secret123"}',
    });
    const tagNames = mockScope.setTag.mock.calls.map((c) => c[0]);
    expect(tagNames).not.toContain('body');
  });

  it('does not set authorization headers as a tag (auth not in context schema)', () => {
    captureServerError(new Error('test'), {
      route: '/api/loans',
      // @ts-expect-error testing invalid context
      authorization: 'Bearer secret-token',
    });
    const tagNames = mockScope.setTag.mock.calls.map((c) => c[0]);
    expect(tagNames).not.toContain('authorization');
  });

  it('only sets defined tags from context (sessionId is allowed, but must be scoped correctly)', () => {
    captureServerError(new Error('test'), {
      sessionId: 'sess-789',
    });
    // sessionId should be tagged as 'session_id'
    const tagCalls = mockScope.setTag.mock.calls;
    expect(tagCalls.some((c) => c[0] === 'session_id')).toBe(true);
    // No extra/sensitive data should be attached
    expect(tagCalls.length).toBe(1);
  });
});

// SUITE 4: captureServerError — edge cases
describe('captureServerError — edge cases', () => {
  it('handles empty context object gracefully', () => {
    expect(() => captureServerError(new Error('test'), {})).not.toThrow();
  });

  it('handles no context argument gracefully', () => {
    expect(() => captureServerError(new Error('test'))).not.toThrow();
  });

  it('captures the error via Sentry', () => {
    const error = new Error('something broke');
    captureServerError(error, { route: '/api/loans' });
    expect(Sentry.captureException).toHaveBeenCalledWith(error);
  });
});
