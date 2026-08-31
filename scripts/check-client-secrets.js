const fs = require('fs');
const path = require('path');

const SECRETS = [
  'PRICE_ORACLE_API_KEY',
  'AUTH_SIGNING_SECRET',
  'SERVER_TOKEN',
  'STELLAR_SIGNING_SECRET',
  'WEBHOOK_SECRET',
  'DATABASE_URL',
];

const FORBIDDEN_IMPORTS = [
  'lib/server-config',
  '@/lib/server-config',
  '../lib/server-config',
  './server-config',
  '../../lib/server-config',
];

const SKIP_DIRS = new Set([
  'node_modules',
  '.next',
  '.git',
  'dist',
  'build',
  'coverage',
  '.npm-cache',
  '.vscode',
  '.kilo',
  '.kiro',
  '.turbo',
  'out',
]);

// Performance bounds
const MAX_FILES_TO_SCAN = 5000;
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB
const MAX_SCAN_DURATION_MS = 30000; // 30 seconds

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function checkFile(filePath, stats) {
  const relativePath = path.relative(process.cwd(), filePath).replace(/\\/g, '/');
  const issues = [];

  // Bound: Skip files exceeding size limit
  if (stats && stats.size > MAX_FILE_SIZE_BYTES) {
    return [];
  }

  let content = '';
  try {
    content = fs.readFileSync(filePath, 'utf8');
  } catch {
    return [];
  }

  for (const forbidden of FORBIDDEN_IMPORTS) {
    const escaped = escapeRegExp(forbidden);
    const importRegex = new RegExp(
      `(?:from\\s+['\"]([^'\"]*${escaped}[^'\"]*)['\"]|import\\s*\\(\\s*['\"]([^'\"]*${escaped}[^'\"]*)['\"]\\s*\\)|require\\s*\\(\\s*['\"]([^'\"]*${escaped}[^'\"]*)['\"]\\s*\\))`,
      'i',
    );

    if (importRegex.test(content)) {
      issues.push(`❌ Error in ${relativePath}: Cannot import server-config in client/shared code.`);
    }
  }

  for (const secret of SECRETS) {
    const escapedSecret = escapeRegExp(secret);
    const secretRegex = new RegExp(
      `process\\.env\\??(?:\\s*\\.?\\s*${escapedSecret}|\\s*\\[\\s*['\"]${escapedSecret}['\"]\\s*\\])`,
      'i',
    );
    if (secretRegex.test(content)) {
      issues.push(`❌ Error in ${relativePath}: Cannot reference secret process.env.${secret} in client/shared code.`);
    }
  }

  return issues;
}

function scanDir(dir, state) {
  // Bound: Enforce max files and timeout
  if (state.filesScanned >= MAX_FILES_TO_SCAN) {
    state.truncated = true;
    return [];
  }
  if (Date.now() - state.startTime > MAX_SCAN_DURATION_MS) {
    state.timedOut = true;
    return [];
  }

  const files = fs.readdirSync(dir);
  const results = [];

  for (const file of files) {
    const fullPath = path.join(dir, file);
    let stat;
    try {
      stat = fs.statSync(fullPath);
    } catch {
      state.errors++;
      continue;
    }

    if (stat.isDirectory()) {
      const relativePath = path.relative(process.cwd(), fullPath).replace(/\\/g, '/');
      if (SKIP_DIRS.has(relativePath) || SKIP_DIRS.has(file)) {
        continue;
      }
      results.push(...scanDir(fullPath, state));
    } else if (stat.isFile() && /\.(js|jsx|ts|tsx)$/.test(file)) {
      state.filesScanned++;
      results.push(...checkFile(fullPath, stat));
    }
  }

  return results;
}

function runScan() {
  const startTime = Date.now();
  const state = {
    filesScanned: 0,
    errors: 0,
    truncated: false,
    timedOut: false,
    startTime,
  };

  const targetDirs = ['app', 'components', 'context', 'utils', 'constants', 'types', 'src', 'hooks'];
  const findings = [];

  for (const dirName of targetDirs) {
    const dirPath = path.join(process.cwd(), dirName);
    if (fs.existsSync(dirPath)) {
      findings.push(...scanDir(dirPath, state));
    }
  }

  const duration = Date.now() - startTime;
  
  return { findings, state, duration };
}

function main() {
  console.log('🔍 Checking client-side code for server secrets and config leakage...');
  const { findings, state, duration } = runScan();

  // Operational visibility: Telemetry without secrets
  console.log(`📊 Scan telemetry:`);
  console.log(`   - Files scanned: ${state.filesScanned}`);
  console.log(`   - Duration: ${duration}ms`);
  console.log(`   - Errors: ${state.errors}`);
  if (state.truncated) {
    console.warn(`   ⚠️  Truncated: Max file limit (${MAX_FILES_TO_SCAN}) reached`);
  }
  if (state.timedOut) {
    console.warn(`   ⚠️  Timeout: Max duration (${MAX_SCAN_DURATION_MS}ms) exceeded`);
  }

  if (findings.length > 0) {
    for (const issue of findings) {
      console.error(issue);
    }
    console.error(`❌ Verification failed: ${findings.length} violation(s) found in client/shared code.`);
    process.exit(1);
  }

  console.log('✅ Verification passed: No secrets or server-config found in client/shared code.');
  process.exit(0);
}

module.exports = {
  SECRETS,
  FORBIDDEN_IMPORTS,
  checkFile,
  scanDir,
  runScan,
};

if (require.main === module) {
  main();
}
