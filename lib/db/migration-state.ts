import { readdir } from 'fs/promises';
import path from 'path';

export type MigrationState = {
  applied: string[];
  pending: string[];
  ok: boolean;
};

export function normalizeName(name: string) {
  return name.replace(/\.js$|\.ts$|\.sql$/i, '');
}

export function compareMigrationLists(sourceMigrations: string[], appliedMigrations: string[]): MigrationState {
  const normalizedSource = sourceMigrations.map(normalizeName).sort();
  const normalizedApplied = appliedMigrations.map(normalizeName).sort();

  const appliedSet = new Set(normalizedApplied);

  const pending = normalizedSource.filter((s) => !appliedSet.has(s));

  return {
    applied: normalizedApplied,
    pending,
    ok: pending.length === 0,
  };
}

export async function listSourceMigrations(migrationsDir?: string): Promise<string[]> {
  const dir = migrationsDir || path.resolve(process.cwd(), 'lib', 'db', 'migrations');
  try {
    const files = await readdir(dir);
    return files.filter(Boolean).sort();
  } catch (err) {
    // If directory doesn't exist, treat as empty
    return [];
  }
}

// `fetchAppliedMigrations` accepts a simple query function for portability and testing.
export async function fetchAppliedMigrations(queryFn: (sql: string, params?: any[]) => Promise<{ rows: any[] }>): Promise<string[]> {
  const res = await queryFn('SELECT name FROM __drizzle_migrations ORDER BY id');
  return (res.rows || []).map((r: any) => r.name).filter(Boolean);
}
