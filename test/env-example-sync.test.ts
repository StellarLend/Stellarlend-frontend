import * as fs from 'fs';
import * as path from 'path';

// === Helpers ===

/** Read .env.example, returning an array of env-var name lines (excluding comments/blanks). */
function parseEnvExample(): string[] {
  const raw = fs.readFileSync(path.resolve(__dirname, '..', '.env.example'), 'utf8');
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('#') && /^[A-Z_][A-Z0-9_]*=/.test(line))
    .map((line) => line.split('=')[0].trim());
}

/** Search the codebase for all process.env.<NAME> references, excluding test files. */
function findEnvReads(rootDir: string): Set<string> {
  const reads = new Set<string>();
  const excludeDirs = new Set(['node_modules', '.git', '.next', 'dist', '.storybook']);

  function walk(dir: string) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!excludeDirs.has(entry.name)) walk(fullPath);
      } else if (/\.(ts|tsx|js|jsx)$/.test(entry.name)) {
        const content = fs.readFileSync(fullPath, 'utf8');
        const matches = content.matchAll(/process\.env\.(\w+)/g);
        for (const m of matches) reads.add(m[1]);
      }
    }
  }

  walk(rootDir);
  return reads;
}

// === Known exemptions ===
// NODE_ENV, CI, NEXT_RUNTIME are standard Next.js/CI env vars that
// don't need to be documented in .env.example.
const EXEMPT = new Set(['NODE_ENV', 'CI', 'NEXT_RUNTIME', 'PLAYWRIGHT_BASE_URL']);

// === Test ===

describe('env-example-sync', () => {
  let envExampleVars: string[];
  let codeEnvReads: Set<string>;

  beforeAll(() => {
    envExampleVars = parseEnvExample();
    codeEnvReads = findEnvReads(path.resolve(__dirname, '..'));
  });

  it('every process.env.* read in source has a corresponding entry in .env.example', () => {
    const missing: string[] = [];

    for (const v of codeEnvReads) {
      if (EXEMPT.has(v)) continue;
      if (!envExampleVars.includes(v)) missing.push(v);
    }

    if (missing.length > 0) {
      console.error('Missing from .env.example:', missing.join(', '));
    }

    expect(missing).toEqual([]);
  });

  it('every non-exempt env var is documented in docs/ENVIRONMENT.md', () => {
    const envDocPath = path.resolve(__dirname, '..', 'docs', 'ENVIRONMENT.md');
    expect(fs.existsSync(envDocPath)).toBe(true);

    const docContent = fs.readFileSync(envDocPath, 'utf8');
    const documentedInDoc: string[] = [];
    const tableRowRegex = /\| ([A-Z_][A-Z0-9_]*) \|/g;
    let match: RegExpExecArray | null;
    while ((match = tableRowRegex.exec(docContent)) !== null) {
      documentedInDoc.push(match[1]);
    }

    const undoc: string[] = [];
    for (const v of codeEnvReads) {
      if (EXEMPT.has(v)) continue;
      if (!documentedInDoc.includes(v)) undoc.push(v);
    }

    if (undoc.length > 0) {
      console.error('Undocumented in docs/ENVIRONMENT.md:', undoc.join(', '));
    }
    expect(undoc).toEqual([]);
  });
});
