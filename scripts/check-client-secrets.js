const fs = require('fs');
const path = require('path');

const SECRETS = [
  'PRICE_ORACLE_API_KEY',
  'AUTH_SIGNING_SECRET',
  'SERVER_TOKEN'
];

const FORBIDDEN_IMPORTS = [
  'lib/server-config',
  '@/lib/server-config'
];

const SECRET_ACCESS = new RegExp(
  `process\\s*(?:\\?\\.)?\\s*env\\s*(?:\\?\\.)?\\s*(?:\\.\\s*(${SECRETS.join('|')})\\b|\\[\\s*[\\\"'](${SECRETS.join('|')})[\\\"']\\s*\\])`,
  'g'
);

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
  }
}

if (require.main === module) main();

module.exports = { scanSource, scanDir, checkFile, main };
