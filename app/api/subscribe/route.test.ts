import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from './route';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockSelect = vi.fn();
const mockInsert = vi.fn();

vi.mock('@/lib/db/client', () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: mockSelect,
        }),
      }),
    }),
    insert: () => ({
      values: mockInsert,
    }),
  },
}));

vi.mock('@/lib/db/schema', () => ({
  subscribers: { id: 'id', email: 'email', subscribedAt: 'subscribedAt' },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const mockRateLimit = vi.fn();
vi.mock('@/lib/rate-limit', () => ({
  rateLimit: (...args: unknown[]) => mockRateLimit(...args),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(body: unknown, ip = '127.0.0.1'): NextRequest {
  return new NextRequest('http://localhost/api/subscribe', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-forwarded-for': ip,
    },
    body: JSON.stringify(body),
  });
}

function makeRawRequest(rawBody: string, ip = '127.0.0.1'): NextRequest {
  return new NextRequest('http://localhost/api/subscribe', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-forwarded-for': ip,
    },
    body: rawBody,
  });
}

const ALLOWED_RATE = {
  success: true,
  limit: 5,
  remaining: 4,
  reset: Date.now() + 600_000,
};

const BLOCKED_RATE = {
  success: false,
  limit: 5,
  remaining: 0,
  reset: Date.now() + 600_000,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/subscribe', () => {
  beforeEach(() => {
    mockRateLimit.mockReturnValue(ALLOWED_RATE);
    mockSelect.mockResolvedValue([]);   // no existing subscriber by default
    mockInsert.mockResolvedValue([{ id: 1, email: 'user@example.com', subscribedAt: new Date() }]);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // Happy path
  // -------------------------------------------------------------------------

  it('returns 200 and success message when email is valid and new', async () => {
    const response = await POST(makeRequest({ email: 'user@example.com' }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.message).toBe('Subscribed successfully.');
    expect(mockInsert).toHaveBeenCalledOnce();
  });

  it('normalizes email to lowercase before inserting', async () => {
    await POST(makeRequest({ email: 'User@Example.COM' }));

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'user@example.com' }),
    );
  });

  it('trims whitespace from email before validation', async () => {
    const response = await POST(makeRequest({ email: '  hello@domain.io  ' }));
    expect(response.status).toBe(200);
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'hello@domain.io' }),
    );
  });

  // -------------------------------------------------------------------------
  // Duplicate email — 409
  // -------------------------------------------------------------------------

  it('returns 409 when the email is already subscribed', async () => {
    mockSelect.mockResolvedValueOnce([{ id: 42 }]); // simulate existing record

    const response = await POST(makeRequest({ email: 'existing@example.com' }));
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error.code).toBe('ALREADY_SUBSCRIBED');
    expect(mockInsert).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Invalid / missing email — 422
  // -------------------------------------------------------------------------

  it('returns 422 when email field is missing', async () => {
    const response = await POST(makeRequest({}));
    const body = await response.json();

    expect(response.status).toBe(422);
    expect(body.error.code).toBe('INVALID_EMAIL');
  });

  it('returns 422 when email is an empty string', async () => {
    const response = await POST(makeRequest({ email: '' }));
    const body = await response.json();

    expect(response.status).toBe(422);
    expect(body.error.code).toBe('INVALID_EMAIL');
  });

  it('returns 422 when email is not a string', async () => {
    const response = await POST(makeRequest({ email: 12345 }));
    const body = await response.json();

    expect(response.status).toBe(422);
    expect(body.error.code).toBe('INVALID_EMAIL');
  });

  it('returns 422 when email format is invalid', async () => {
    const response = await POST(makeRequest({ email: 'not-an-email' }));
    const body = await response.json();

    expect(response.status).toBe(422);
    expect(body.error.code).toBe('INVALID_EMAIL');
  });

  it('returns 422 when email is missing the domain extension', async () => {
    const response = await POST(makeRequest({ email: 'user@nodomain' }));
    const body = await response.json();

    expect(response.status).toBe(422);
    expect(body.error.code).toBe('INVALID_EMAIL');
  });

  // -------------------------------------------------------------------------
  // Malformed JSON body — 422
  // -------------------------------------------------------------------------

  it('returns 422 when body is not valid JSON', async () => {
    const response = await POST(makeRawRequest('{ not valid json '));
    const body = await response.json();

    expect(response.status).toBe(422);
    expect(body.error.code).toBe('INVALID_BODY');
  });

  it('returns 422 when body is a JSON array instead of an object', async () => {
    const response = await POST(makeRequest(['user@example.com']));
    const body = await response.json();

    expect(response.status).toBe(422);
    expect(body.error.code).toBe('INVALID_BODY');
  });

  // -------------------------------------------------------------------------
  // Rate limiting — 429
  // -------------------------------------------------------------------------

  it('returns 429 when rate limit is exceeded', async () => {
    mockRateLimit.mockReturnValue(BLOCKED_RATE);

    const response = await POST(makeRequest({ email: 'user@example.com' }));
    const body = await response.json();

    expect(response.status).toBe(429);
    expect(body.error.code).toBe('RATE_LIMITED');
    expect(response.headers.get('Retry-After')).toBeTruthy();
    expect(response.headers.get('RateLimit-Limit')).toBe('5');
    expect(response.headers.get('RateLimit-Remaining')).toBe('0');
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it('uses the x-forwarded-for IP as the rate-limit key', async () => {
    await POST(makeRequest({ email: 'a@example.com' }, '10.0.0.1'));

    expect(mockRateLimit).toHaveBeenCalledWith(
      'subscribe:10.0.0.1',
      expect.any(Number),
      expect.any(Number),
    );
  });

  it('falls back to "unknown" when no IP header is present', async () => {
    const req = new NextRequest('http://localhost/api/subscribe', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'b@example.com' }),
    });

    await POST(req);

    expect(mockRateLimit).toHaveBeenCalledWith(
      'subscribe:unknown',
      expect.any(Number),
      expect.any(Number),
    );
  });
});
