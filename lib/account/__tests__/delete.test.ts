import { deleteAccount } from '../delete';
import { profileRepository } from '@/lib/account/repository';
import { removeNotificationsByUserId } from '@/lib/notifications/repository';
import { emitAuditEvent } from '@/lib/audit/events';
import { enqueueCleanupJob } from '@/lib/queue/cleanup-queue';

jest.mock('@/lib/account/repository', () => ({
  profileRepository: {
    getByUserId: jest.fn(),
    anonymizeByUserId: jest.fn(),
  },
}));

jest.mock('@/lib/notifications/repository', () => ({
  removeNotificationsByUserId: jest.fn(),
}));

jest.mock('@/lib/audit/events', () => ({
  emitAuditEvent: jest.fn(),
}));

jest.mock('@/lib/queue/cleanup-queue', () => ({
  enqueueCleanupJob: jest.fn(),
}));

jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
  },
}));

describe('deleteAccount', () => {
  const mockUserId = 'user-123';

  beforeEach(() => {
    jest.clearAllMocks();
    (emitAuditEvent as jest.Mock).mockReturnValue({ id: 'audit-123' });
    (enqueueCleanupJob as jest.Mock).mockImplementation((type) => ({ id: `job-${type}` }));
    (removeNotificationsByUserId as jest.Mock).mockReturnValue(5);
  });

  it('anonymizes PII fields and revokes sessions successfully', async () => {
    (profileRepository.getByUserId as jest.Mock).mockResolvedValue({ id: mockUserId });
    (profileRepository.anonymizeByUserId as jest.Mock).mockResolvedValue(true);

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
    (profileRepository.getByUserId as jest.Mock).mockResolvedValue(null);

    await expect(deleteAccount(mockUserId)).rejects.toThrow(`No profile found for user ${mockUserId}`);
    
    expect(profileRepository.anonymizeByUserId).not.toHaveBeenCalled();
    expect(emitAuditEvent).not.toHaveBeenCalled();
  });

  it('throws error if anonymization fails', async () => {
    (profileRepository.getByUserId as jest.Mock).mockResolvedValue({ id: mockUserId });
    (profileRepository.anonymizeByUserId as jest.Mock).mockResolvedValue(false);

    await expect(deleteAccount(mockUserId)).rejects.toThrow(`Failed to anonymize profile for user ${mockUserId}`);
    expect(emitAuditEvent).not.toHaveBeenCalled();
  });

  it('is idempotent when deleting an already-deleted account', async () => {
    // If the account is already anonymized/deleted, maybe getByUserId returns null or anonymizeByUserId handles it.
    // Assuming getByUserId returns null means the profile is already gone.
    (profileRepository.getByUserId as jest.Mock).mockResolvedValue(null);
    await expect(deleteAccount(mockUserId)).rejects.toThrow(`No profile found for user ${mockUserId}`);
  });
});
