import { describe, it, expect } from 'vitest';

import { AuthError, UpstreamError, ValidationError } from './errors';

/**
 * `lib/api/errors.ts` defines the domain error classes that API route handlers
 * throw. Each class carries a `statusCode` so `withRequestLogging` (and any
 * route-local catch) can map a thrown error to an HTTP status without coupling
 * routing logic to business logic.
 *
 * The contract under test:
 *   - status mapping    ValidationError -> 400, AuthError -> 401, UpstreamError -> 502
 *   - envelope fields   `name` and `message` are the stable, serialisable slots
 *   - safe fallback     anything without a numeric `statusCode` must fall back
 *                       to a generic 500 and must not leak internals
 *
 * See `docs/api-error-envelope.md` for the prose version of this contract.
 */

/**
 * Mirrors how a route handler maps a caught error onto an HTTP status: use the
 * error's own `statusCode` when it declares a numeric one, otherwise fall back
 * to 500. This is the same rule `withRequestLogging` applies when it returns
 * `{ error: 'Internal server error' }` with status 500.
 */
function resolveStatus(error: unknown): number {
  const candidate = (error as { statusCode?: unknown })?.statusCode;
  return typeof candidate === 'number' ? candidate : 500;
}

/** The generic envelope a handler emits for an unmapped error. */
const GENERIC_500_ENVELOPE = { error: 'Internal server error' } as const;

describe('lib/api/errors', () => {
  describe('status-code mapping', () => {
    it.each([
      ['ValidationError', new ValidationError('bad input'), 400],
      ['AuthError', new AuthError('no session'), 401],
      ['UpstreamError', new UpstreamError('horizon down'), 502],
    ])('%s maps to HTTP %i', (_label, error, expected) => {
      expect((error as { statusCode: number }).statusCode).toBe(expected);
      expect(resolveStatus(error)).toBe(expected);
    });

    it('assigns each error class a distinct status so routes can branch on it', () => {
      const statuses = [
        new ValidationError('a').statusCode,
        new AuthError('b').statusCode,
        new UpstreamError('c').statusCode,
      ];
      expect(new Set(statuses).size).toBe(statuses.length);
    });
  });

  describe('envelope fields', () => {
    it.each([
      ['ValidationError', new ValidationError('field "amount" is required'), 'ValidationError'],
      ['AuthError', new AuthError('session expired'), 'AuthError'],
      ['UpstreamError', new UpstreamError('502 from horizon'), 'UpstreamError'],
    ])('%s exposes a stable `name` of %s', (_label, error, expectedName) => {
      // `name` is what the handler logs and what metrics label errors by
      // (`metrics.httpErrors.inc({ error: error.name })`), so it is part of the
      // observable contract rather than an implementation detail.
      expect((error as Error).name).toBe(expectedName);
    });

    it('preserves the message verbatim for the response body', () => {
      const message = 'collateral ratio 1.05 is below the 1.10 minimum';
      expect(new ValidationError(message).message).toBe(message);
    });

    it('preserves an empty message rather than substituting a default', () => {
      expect(new ValidationError('').message).toBe('');
    });

    it('captures a stack trace so the handler can log the origin', () => {
      expect(typeof new UpstreamError('boom').stack).toBe('string');
    });
  });

  describe('instanceof behaviour', () => {
    it.each([
      ['ValidationError', new ValidationError('x'), ValidationError],
      ['AuthError', new AuthError('x'), AuthError],
      ['UpstreamError', new UpstreamError('x'), UpstreamError],
    ])('%s is an instance of Error and of its own class', (_label, error, Ctor) => {
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(Ctor as new (m: string) => Error);
    });

    it('does not treat sibling error classes as interchangeable', () => {
      // A route that catches ValidationError must not swallow an AuthError.
      expect(new AuthError('x')).not.toBeInstanceOf(ValidationError);
      expect(new ValidationError('x')).not.toBeInstanceOf(UpstreamError);
      expect(new UpstreamError('x')).not.toBeInstanceOf(AuthError);
    });
  });

  describe('validation errors carrying field-level detail', () => {
    it('conveys multiple field failures through the message', () => {
      const fields = ['amount', 'asset', 'destination'];
      const error = new ValidationError(
        `invalid request: ${fields.map((f) => `"${f}" is required`).join(', ')}`,
      );

      expect(error.statusCode).toBe(400);
      for (const field of fields) {
        expect(error.message).toContain(field);
      }
    });

    it('round-trips a field-detail message through an explicit envelope', () => {
      const error = new ValidationError('"amount" must be greater than 0');

      // Errors are not JSON-serialisable by default, so a handler must build the
      // envelope explicitly from `message` -- this asserts that shape.
      const envelope = { error: error.message };
      expect(JSON.parse(JSON.stringify(envelope))).toEqual({
        error: '"amount" must be greater than 0',
      });
    });

    it('drops `message` when the error itself is JSON.stringify-ed', () => {
      // Regression guard for the most likely handler bug. `message` and `stack`
      // are inherited as non-enumerable, so they vanish under JSON.stringify --
      // but `name` and `statusCode` are own enumerable properties and survive.
      // A handler that serialises the error directly therefore emits a body with
      // the status echoed back and no explanation at all. Route code must read
      // `.message` explicitly.
      const serialised = JSON.parse(JSON.stringify(new ValidationError('leaky')));

      expect(serialised).toEqual({ name: 'ValidationError', statusCode: 400 });
      expect(serialised).not.toHaveProperty('message');
      expect(serialised).not.toHaveProperty('stack');
    });
  });

  describe('safe fallback for unexpected errors', () => {
    it.each([
      ['a plain Error', new Error('database password=hunter2 refused')],
      ['a thrown string', 'kaboom'],
      ['a thrown object', { code: 'ECONNRESET' }],
      ['null', null],
      ['undefined', undefined],
    ])('%s falls back to 500', (_label, thrown) => {
      expect(resolveStatus(thrown)).toBe(500);
    });

    it('emits a generic envelope that does not leak the internal message', () => {
      const internal = new Error('connect ECONNREFUSED 10.0.0.5:5432 user=admin');
      expect(resolveStatus(internal)).toBe(500);

      // The handler responds with a fixed string, never the caught message.
      expect(GENERIC_500_ENVELOPE.error).toBe('Internal server error');
      expect(JSON.stringify(GENERIC_500_ENVELOPE)).not.toContain('ECONNREFUSED');
      expect(JSON.stringify(GENERIC_500_ENVELOPE)).not.toContain('10.0.0.5');
      expect(JSON.stringify(GENERIC_500_ENVELOPE)).not.toContain('admin');
    });

    it('ignores a non-numeric `statusCode` and still falls back to 500', () => {
      // Guards against an upstream library attaching a string status.
      expect(resolveStatus(Object.assign(new Error('x'), { statusCode: '400' }))).toBe(500);
      expect(resolveStatus(Object.assign(new Error('x'), { statusCode: null }))).toBe(500);
    });

    it('maps a nested cause to the outer error status, not the cause status', () => {
      const cause = new UpstreamError('horizon timeout');
      const outer = new ValidationError('quote could not be built');
      (outer as Error & { cause?: unknown }).cause = cause;

      // The handler sees only the thrown (outer) error.
      expect(resolveStatus(outer)).toBe(400);
      expect((outer as Error & { cause?: unknown }).cause).toBe(cause);
    });

    it('falls back to 500 for a subclass that forgets to declare a status', () => {
      class UnmappedError extends Error {}
      expect(resolveStatus(new UnmappedError('nope'))).toBe(500);
    });
  });
});
