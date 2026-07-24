import { describe, it, expect, vi } from 'vitest';
import { fetchAppliedMigrations, MigrationRow } from './migration-state';

describe('fetchAppliedMigrations', () => {
  it('returns migration names from queryFn rows', async () => {
    const rows: MigrationRow[] = [
      { name: '0001_create_accounts' },
      { name: '0002_create_sessions' },
    ];
    const queryFn = vi.fn().mockResolvedValue({ rows });

    const result = await fetchAppliedMigrations(queryFn);

    expect(result).toEqual(['0001_create_accounts', '0002_create_sessions']);
  });

  it('calls queryFn with the expected SQL', async () => {
    const queryFn = vi.fn().mockResolvedValue({ rows: [] });

    await fetchAppliedMigrations(queryFn);

    expect(queryFn).toHaveBeenCalledWith('SELECT name FROM __drizzle_migrations ORDER BY id');
  });

  it('returns an empty array when queryFn returns no rows', async () => {
    const queryFn = vi.fn().mockResolvedValue({ rows: [] });

    const result = await fetchAppliedMigrations(queryFn);

    expect(result).toEqual([]);
  });

  it('filters out falsy name values', async () => {
    const rows = [
      { name: '0001_init' },
      { name: '' },
      { name: '0003_add_index' },
    ] as MigrationRow[];
    const queryFn = vi.fn().mockResolvedValue({ rows });

    const result = await fetchAppliedMigrations(queryFn);

    expect(result).toEqual(['0001_init', '0003_add_index']);
  });

  it('handles queryFn returning undefined rows gracefully', async () => {
    const queryFn = vi.fn().mockResolvedValue({} as { rows: MigrationRow[] });

    const result = await fetchAppliedMigrations(queryFn);

    expect(result).toEqual([]);
  });
});
