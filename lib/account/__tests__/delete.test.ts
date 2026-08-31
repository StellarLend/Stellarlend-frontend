import { describe, it, expect, vi, beforeEach } from 'vitest';
import { deleteAccount } from '../delete';
import { profileRepository } from '@/lib/account/repository';
import { removeNotificationsByUserId } from '@/lib/notifications/repository';
import { emitAuditEvent } from '@/lib/audit/events';
import { enqueueCleanupJob } from '@/lib/queue/cleanup-queue';

vi.mock('@/lib/account/repository', () => ({
  profileRepository: {
    getByUserId: vi.fn(),
    anonymizeByUserId: vi.fn(),
  },
}));

vi.mock('@/lib/notifications/repository', () => ({
  removeNotificationsByUserId: vi.fn(),
}));

vi.mock('@/lib/audit/events', () => ({
  emitAuditEvent: vi.fn(),
}));

vi.mock('@/lib/queue/cleanup-queue', () => ({
  enqueueCleanupJob: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
  },
}));

describe('deleteAccount', () => {
  const mockUserId = 'user-123';

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(emitAuditEvent).mockReturnValue({ id: 'audit-123' } as any);
    vi.mocked(enqueueCleanupJob).mockImplementation((type: any) => ({ id: `job-${type}` }) as any);
    vi.mocked(removeNotificationsByUserId).mockReturnValue(5);
  });

  it('anonymizes PII fields and revokes sessions successfully', async () => {
    vi.mocked(profileRepository.getByUserId).mockResolvedValue({ id: mockUserId } as any);
    vi.mocked(profileRepository.anonymizeByUserId).mockResolvedValue(true);

    const result = await deleteAccount(mockUserId);

    expect(result.success).toBe(true);
    expect(profileRepository.anonymizeByUserId).toHaveBeenCalledWith(mockUserId);
    expect(removeNotificationsByUserId).toHaveBeenCalledWith(mockUserId);
    expect(enqueueCleanupJob).toHaveBeenCalledWith('anonymize-backups', mockUserId);
    expect(emitAuditEvent).toHaveBeenCalledWith('sessions.revoked', mockUserId, expect.any(Object));
    expect(emitAuditEvent).toHaveBeenCalledWith('account.deleted', mockUserId, expect.objectContaining({
      anonymizedFields: expect.arrayContaining(['displayName', 'bio', 'website', 'timezone'])
    }));
  });

  it('throws error if profile not found', async () => {
    vi.mocked(profileRepository.getByUserId).mockResolvedValue(null);

    await expect(deleteAccount(mockUserId)).rejects.toThrow(`No profile found for user ${mockUserId}`);
    
    expect(profileRepository.anonymizeByUserId).not.toHaveBeenCalled();
    expect(emitAuditEvent).not.toHaveBeenCalled();
  });

  it('throws error if anonymization fails', async () => {
    vi.mocked(profileRepository.getByUserId).mockResolvedValue({ id: mockUserId } as any);
    vi.mocked(profileRepository.anonymizeByUserId).mockResolvedValue(false);

    await expect(deleteAccount(mockUserId)).rejects.toThrow(`Failed to anonymize profile for user ${mockUserId}`);
    expect(emitAuditEvent).not.toHaveBeenCalled();
  });

  it('is idempotent when deleting an already-deleted account', async () => {
    vi.mocked(profileRepository.getByUserId).mockResolvedValue(null);
    await expect(deleteAccount(mockUserId)).rejects.toThrow(`No profile found for user ${mockUserId}`);
  });
});
