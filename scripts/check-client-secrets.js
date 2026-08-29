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

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function checkFile(filePath) {
  let content = '';
  try {
    content = fs.readFileSync(filePath, 'utf8');
  } catch {
    return [];
  }

  const relativePath = path.relative(process.cwd(), filePath).replace(/\\/g, '/');
  const issues = [];

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

function scanDir(dir) {
  const files = fs.readdirSync(dir);
  const results = [];

  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      const relativePath = path.relative(process.cwd(), fullPath).replace(/\\/g, '/');
      if (relativePath === 'app/api') {
        continue;
      }
      results.push(...scanDir(fullPath));
    } else if (stat.isFile() && /\.(js|jsx|ts|tsx)$/.test(file)) {
      results.push(...checkFile(fullPath));
    }
  }

  return results;
}

function runScan() {
  const targetDirs = ['app', 'components', 'context', 'utils', 'constants', 'types', 'src', 'hooks'];
  const findings = [];

  for (const dirName of targetDirs) {
    const dirPath = path.join(process.cwd(), dirName);
    if (fs.existsSync(dirPath)) {
      findings.push(...scanDir(dirPath));
    }
  }

  return findings;
}

function main() {
  console.log('🔍 Checking client-side code for server secrets and config leakage...');
  const findings = runScan();

  if (findings.length > 0) {
    for (const issue of findings) {
      console.error(issue);
    }
    console.error('❌ Verification failed: Secrets or server-config found in client/shared code.');
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
