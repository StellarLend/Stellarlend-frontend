import { describe, it, expect, vi, beforeEach } from 'vitest';
import { profileRepository } from '../repository';
import { db } from '../../db';

vi.mock('../../db', () => {
  const mockSelectResult = [] as any[];
  const mockSelect = vi.fn(() => ({
    from: vi.fn(() => ({
      where: vi.fn(() => ({
        limit: vi.fn(async () => mockSelectResult),
      })),
    })),
  }));

  const mockInsert = vi.fn(() => ({
    values: vi.fn(() => ({
      onConflictDoUpdate: vi.fn(async () => ({})),
    })),
  }));

  return {
    db: {
      select: mockSelect,
      insert: mockInsert,
    },
  };
});

describe('Drizzle Profile Repository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null if account profile does not exist', async () => {
    const mockSelect = vi.mocked(db.select);
    mockSelect.mockReturnValueOnce({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(async () => []),
        })),
      })),
    } as any);

    const profile = await profileRepository.getByUserId('user-1');
    expect(profile).toBeNull();
  });

  it('returns profile if it exists', async () => {
    const mockRecord = {
      userId: 'user-1',
      displayName: 'Test User',
      bio: 'Test Bio',
      website: 'https://test.com',
      timezone: 'UTC',
      updatedAt: new Date(),
    };

    const mockSelect = vi.mocked(db.select);
    mockSelect.mockReturnValueOnce({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(async () => [mockRecord]),
        })),
      })),
    } as any);

    const profile = await profileRepository.getByUserId('user-1');
    expect(profile).toEqual(mockRecord);
  });

  it('performs upsert successfully', async () => {
    const data = {
      displayName: 'New Name',
      bio: 'New Bio',
      website: 'https://new.com',
      timezone: 'EST',
    };

    const profile = await profileRepository.upsert('user-1', data);
    expect(profile.userId).toBe('user-1');
    expect(profile.displayName).toBe('New Name');
    expect(db.insert).toHaveBeenCalled();
  });
});
