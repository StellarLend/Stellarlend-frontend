import { fetchAppliedMigrations, MigrationRow } from './migration-state';

describe('fetchAppliedMigrations', () => {
  it('should return applied migrations from queryFn', async () => {
    const mockRows: MigrationRow[] = [{ name: '0001_initial' }, { name: '0002_add_users' }];
    const queryFn = async (sql: string, params?: unknown[]) => {
      return { rows: mockRows };
    };

    const result = await fetchAppliedMigrations(queryFn);
    expect(result).toEqual(['0001_initial', '0002_add_users']);
  });

  it('should filter out empty or falsy names', async () => {
    const mockRows = [{ name: '0001_initial' }, { name: '' }] as MigrationRow[];
    const queryFn = async (sql: string, params?: unknown[]) => {
      return { rows: mockRows };
    };

    const result = await fetchAppliedMigrations(queryFn);
    expect(result).toEqual(['0001_initial']);
  });

  it('should handle undefined rows gracefully (if possible, though type says MigrationRow[])', async () => {
    const queryFn = async (sql: string, params?: unknown[]) => {
      return { rows: undefined as unknown as MigrationRow[] };
    };

    const result = await fetchAppliedMigrations(queryFn);
    expect(result).toEqual([]);
  });
});
