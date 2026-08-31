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

const SECRET_ACCESS = new RegExp(
  `process\\s*(?:\\.|\\?\\.)\\s*env\\s*(?:\\.|\\?\\.)?\\s*(?:(${SECRETS.join('|')})\\b|\\[\\s*[\\\"'](${SECRETS.join('|')})[\\\"']\\s*\\])`,
  'g'
);
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

const IMPORT_PATTERNS = FORBIDDEN_IMPORTS.map((moduleName) =>
  new RegExp(
    `(?:from\\s*|import\\s*\\(|require\\s*\\(|import\\s+)['\"]${moduleName.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&')}['\"]`,
    'i'
  )
);

function scanSource(content, relativePath) {
  const errors = [];

  for (const pattern of IMPORT_PATTERNS) {
    if (pattern.test(content)) {
      errors.push(`❌ Error in ${relativePath}: Cannot import server-config in client/shared code.`);
      break;
    }
  }

  SECRET_ACCESS.lastIndex = 0;
  let match;
  while ((match = SECRET_ACCESS.exec(content)) !== null) {
    const secret = match[1] || match[2];
    errors.push(`❌ Error in ${relativePath}: Cannot reference secret process.env.${secret} in client/shared code.`);
  }

  return errors;
}

function scanDir(dir, errors = []) {
  const files = fs.readdirSync(dir);
  const results = [];

  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      const relativePath = path.relative(process.cwd(), fullPath).replace(/\\\\/g, '/');
      if (relativePath === 'app/api') continue;
      scanDir(fullPath, errors);
    } else if (stat.isFile() && /\\.(js|jsx|ts|tsx)$/.test(file)) {
      checkFile(fullPath, errors);
    }
  }
  return errors;
}

function checkFile(filePath, errors = []) {
  const content = fs.readFileSync(filePath, 'utf8');
  const relativePath = path.relative(process.cwd(), filePath).replace(/\\\\/g, '/');
  errors.push(...scanSource(content, relativePath));
  return errors;
}

function main() {
  let errors = [];
  console.log('🔍 Checking client-side code for server secrets and config leakage...');

  const targetDirs = ['app', 'components', 'context', 'utils', 'constants', 'types'];
  for (const dirName of targetDirs) {
    const dirPath = path.join(process.cwd(), dirName);
    if (fs.existsSync(dirPath)) errors = scanDir(dirPath, errors);
  }

  if (errors.length > 0) {
    errors.forEach((error) => console.error(error));
    console.error('❌ Verification failed: Secrets or server-config found in client/shared code.');
    process.exitCode = 1;
  } else {
    console.log('✅ Verification passed: No secrets or server-config found in client/shared code.');
      const relativePath = path.relative(process.cwd(), fullPath).replace(/\\/g, '/');
      if (SKIP_DIRS.has(relativePath) || SKIP_DIRS.has(file)) {
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

if (require.main === module) main();

module.exports = { scanSource, scanDir, checkFile, main };
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
