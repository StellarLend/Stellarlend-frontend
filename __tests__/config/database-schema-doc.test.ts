import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { resolve, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// vitest may run with a different cwd than the test file location, so
// resolve the test file's own directory and walk up from there.
const __filename = fileURLToPath(import.meta.url);
const __dirname = resolve(__filename, '..');

const REPO_ROOT = resolve(__dirname, '..', '..');
const DOC_PATH = resolve(REPO_ROOT, 'docs', 'database-schema.md');
const SCHEMA_DIR = resolve(REPO_ROOT, 'lib', 'db', 'schema');
const DRIZZLE_DIR = resolve(REPO_ROOT, 'drizzle');
const DRIZZLE_CONFIG = resolve(REPO_ROOT, 'drizzle.config.ts');
const MIGRATE_RUNNER = resolve(REPO_ROOT, 'lib', 'db', 'migrate.ts');
const MIGRATE_WORKFLOW = resolve(REPO_ROOT, '.github', 'workflows', 'migrate.yml');

function readDoc(): string {
  expect(existsSync(DOC_PATH)).toBe(true);
  return readFileSync(DOC_PATH, 'utf8');
}

function listSchemaFiles(): string[] {
  return readdirSync(SCHEMA_DIR)
    .filter((name) => name.endsWith('.ts') && name !== 'index.ts')
    .filter((name) => statSync(resolve(SCHEMA_DIR, name)).isFile())
    .map((name) => basename(name, '.ts'))
    .sort();
}

function listMigrationFiles(): string[] {
  return readdirSync(DRIZZLE_DIR)
    .filter((name) => name.endsWith('.sql'))
    .map((name) => basename(name, '.sql'))
    .sort();
}

describe('docs/database-schema.md', () => {
  it('exists and is non-empty', () => {
    const doc = readDoc();
    expect(doc.length).toBeGreaterThan(200);
  });

  it('lists every table file in lib/db/schema/ (no missing-table drift)', () => {
    const doc = readDoc();
    const tables = listSchemaFiles();

    // Every schema file (minus .ts extension) must be referenced in the doc.
    // This is the canary: a contributor who adds a new table without
    // updating the doc will fail this test.
    expect(tables.length).toBeGreaterThan(0);
    for (const table of tables) {
      expect(doc, `doc missing table "${table}"`).toContain(table);
      expect(doc, `doc missing schema file path for "${table}"`).toContain(`lib/db/schema/${table}.ts`);
    }
  });

  it('references the drizzle migrations directory and the runner', () => {
    const doc = readDoc();
    expect(doc).toMatch(/drizzle\//);
    expect(doc).toContain('lib/db/migrate.ts');
  });

  it('points at the actual drizzle.config.ts and CI workflow', () => {
    const doc = readDoc();
    expect(doc).toContain('drizzle.config.ts');
    expect(doc).toContain('.github/workflows/migrate.yml');

    // Sanity: those files should still exist on disk.
    expect(existsSync(DRIZZLE_CONFIG)).toBe(true);
    expect(existsSync(MIGRATE_RUNNER)).toBe(true);
    expect(existsSync(MIGRATE_WORKFLOW)).toBe(true);
  });

  it('lists the existing SQL migrations present in drizzle/', () => {
    const doc = readDoc();
    const migrations = listMigrationFiles();

    // Documenting the initial migration by number is enough to keep the
    // first commit anchored; new migrations are tracked in the
    // "Generating a new migration" workflow section.
    if (migrations.length > 0) {
      const first = migrations[0];
      const number = first.split('_')[0];
      // Migration filenames look like "0000_init.sql" — `\b` won't match
      // between a digit and `_`, so use a non-word-boundary lookahead
      // that allows for either `_` or end-of-string after the number.
      expect(doc).toMatch(new RegExp(`drizzle/${number}(?=_|\\b|\\d|$)`));
    }
  });

  it('documents the transactions composite index actually present in the schema', () => {
    const doc = readDoc();
    const transactions = readFileSync(
      resolve(SCHEMA_DIR, 'transactions.ts'),
      'utf8',
    );

    // Pull the index name out of the source.
    const match = transactions.match(/index\('([^']+)'\)/);
    expect(match).not.toBeNull();
    const indexName = match![1];

    expect(doc).toContain(indexName);
  });

  it('enumerates the notification type union in source', () => {
    const doc = readDoc();
    const notifications = readFileSync(
      resolve(SCHEMA_DIR, 'notifications.ts'),
      'utf8',
    );

    // The `type` column has an inline union comment in the schema. The
    // doc must list every value so it stays accurate.
    const match = notifications.match(/\/\/\s*'([^']+)'/);
    expect(match).not.toBeNull();
    const types = match![1]
      .split('|')
      .map((t) => t.trim().replace(/['\s]/g, ''))
      .filter(Boolean);

    for (const t of types) {
      expect(doc, `doc missing notification type "${t}"`).toContain(t);
    }
  });
});
