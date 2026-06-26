import { afterEach, describe, expect, it, vi } from 'vitest';
import { processAccountExport, type ExportDataPayload } from './export-bundle';

const VALID_PAYLOAD: ExportDataPayload = {
  userId: 'user-123',
  profile: {
    id: 'user-123',
    email: 'user@example.com',
  },
  preferences: {
    currency: 'USD',
    notifications: true,
  },
  transactions: [
    { id: 'tx-1', userId: 'user-123', amount: '10.00' },
    { id: 'tx-other', userId: 'user-999', amount: '999.00' },
  ],
  notifications: [
    { id: 'note-1', userId: 'user-123', read: false },
    { id: 'note-other', userId: 'user-456', read: true },
  ],
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('processAccountExport', () => {
  it('throws when the user id is missing', async () => {
    await expect(
      processAccountExport({
        ...VALID_PAYLOAD,
        userId: '',
      }),
    ).rejects.toThrow('Missing required user contextual identifier.');
  });

  it('returns a signed URL scoped to the requesting user and stable export key', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000);

    const url = await processAccountExport(VALID_PAYLOAD);
    const parsed = new URL(url);

    expect(parsed.origin).toBe('https://storage.stellarlend.com');
    expect(parsed.pathname).toBe('/exports/user-123/1700000000000-dsar.zip');
    expect(parsed.searchParams.get('X-Amz-Algorithm')).toBe('AWS4-HMAC-SHA256');
    expect(parsed.searchParams.get('X-Amz-Expires')).toBe('900');
  });

  it('does not leak unrelated user identifiers into the returned storage key or URL', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000);

    const url = await processAccountExport(VALID_PAYLOAD);

    expect(url).toContain('/exports/user-123/');
    expect(url).not.toContain('user-999');
    expect(url).not.toContain('user-456');
    expect(url).not.toContain('tx-other');
    expect(url).not.toContain('note-other');
  });
});
