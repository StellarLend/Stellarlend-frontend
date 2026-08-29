const fs = require('fs');
const path = require('path');

const SECRETS = [
  'PRICE_ORACLE_API_KEY',
  'AUTH_SIGNING_SECRET',
  'SERVER_TOKEN',
  'SOROBAN_RPC_URL',
  'WEBHOOK_SECRET',
  'STELLAR_SIGNING_SECRET',
];

const FORBIDDEN_IMPORTS = [
  'lib/server-config',
  '@/lib/server-config'
];

// Directories that are always server-side or generated — never scan them.
const SKIP_DIRS = new Set([
  'app/api',
  'node_modules',
  '.next',
  '.git',
]);

// Files that legitimately define secret names as string constants for detection/validation purposes.
const ALLOWLIST_PATHS = new Set([
  'lib/security/secret-patterns.ts',
  'scripts/check-client-secrets.js',
]);

let hasErrors = false;

function scanDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      const relativePath = path.relative(process.cwd(), fullPath).replace(/\\/g, '/');
      if (SKIP_DIRS.has(relativePath) || SKIP_DIRS.has(file)) {
        continue;
      }
      scanDir(fullPath);
    } else if (stat.isFile() && /\.(js|jsx|ts|tsx)$/.test(file)) {
      checkFile(fullPath);
    }
  }
}

function checkFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const relativePath = path.relative(process.cwd(), filePath).replace(/\\/g, '/');

  if (ALLOWLIST_PATHS.has(relativePath)) {
    return;
  }

  for (const forbidden of FORBIDDEN_IMPORTS) {
    // Match: from 'lib/server-config' or from "lib/server-config"
    const importRegex = new RegExp(`from\\s+['"]([^'"]*${forbidden.replace('/', '\\/')}[^'"]*)['"]`, 'i');
    if (importRegex.test(content)) {
      console.error(`❌ Error in ${relativePath}: Cannot import server-config in client/shared code.`);
      hasErrors = true;
    }
  }

  for (const secret of SECRETS) {
    const secretRegex = new RegExp(`process\\.env\\.${secret}\\b`);
    if (secretRegex.test(content)) {
      console.error(`❌ Error in ${relativePath}: Cannot reference secret process.env.${secret} in client/shared code.`);
      hasErrors = true;
    }
  }
}

console.log('🔍 Checking client-side code for server secrets and config leakage...');

const targetDirs = ['app', 'components', 'context', 'hooks', 'utils', 'constants', 'types'];

for (const dirName of targetDirs) {
  const dirPath = path.join(process.cwd(), dirName);
  if (fs.existsSync(dirPath)) {
    scanDir(dirPath);
  }
}

if (hasErrors) {
  console.error('❌ Verification failed: Secrets or server-config found in client/shared code.');
  process.exit(1);
} else {
  console.log('✅ Verification passed: No secrets or server-config found in client/shared code.');
  process.exit(0);
}
