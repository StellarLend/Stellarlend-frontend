import { describe, it, expect, vi, beforeEach } from 'vitest';
import { profileRepository } from '../repository';
import { db } from '../../db';

const { mockDb, mockSelect, mockInsert } = vi.hoisted(() => {
  const mockSelectResult = [] as any[];
  const select = vi.fn(() => ({
    from: vi.fn(() => ({
      where: vi.fn(() => ({
        limit: vi.fn(async () => mockSelectResult),
      })),
    })),
  }));

  const insert = vi.fn(() => ({
    values: vi.fn((vals: any) => ({
      onConflictDoUpdate: vi.fn(() => ({
        returning: vi.fn(async () => [vals]),
        all: vi.fn(() => [vals]),
        then: vi.fn((resolve) => resolve([vals])),
      })),
    })),
  }));

  return {
    mockDb: { select, insert },
    mockSelect: select,
    mockInsert: insert,
  };
});

vi.mock('../../db', () => ({ db: mockDb }));
vi.mock('../../db/client', () => ({ db: mockDb }));
vi.mock('@/lib/db/client', () => ({ db: mockDb }));

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

    const mockInsert = vi.mocked(db.insert);
    mockInsert.mockReturnValueOnce({
      values: vi.fn(() => ({
        onConflictDoUpdate: vi.fn(() => ({
          returning: vi.fn(async () => [{
            userId: 'user-1',
            displayName: 'New Name',
            bio: 'New Bio',
            website: 'https://new.com',
            timezone: 'EST',
            updatedAt: new Date(),
          }]),
        })),
      })),
    } as any);

    const profile = await profileRepository.upsert('user-1', data);
    expect(profile.userId).toBe('user-1');
    expect(profile.displayName).toBe('New Name');
    expect(db.insert).toHaveBeenCalled();
  });
});
