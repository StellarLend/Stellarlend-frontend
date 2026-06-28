import { describe, it, expect, vi } from 'vitest';
import { processAccountExport, ExportDataPayload } from '../export-bundle';

describe('processAccountExport', () => {
  it('throws when userId is absent', async () => {
    const payload = { userId: '', profile: {}, preferences: {}, transactions: [], notifications: [] } as ExportDataPayload;
    await expect(processAccountExport(payload)).rejects.toThrow('Missing required user contextual identifier.');
  });

  it('returns URL scoped to user with short expiry', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1000000);
    const payload: ExportDataPayload = { userId: 'user-123', profile: {}, preferences: {}, transactions: [], notifications: [] };
    const url = await processAccountExport(payload);
    expect(url).toContain('exports/user-123/');
    expect(url).toContain('X-Amz-Expires=900');
    expect(url).toContain('1000000-dsar.zip');
  });
});
