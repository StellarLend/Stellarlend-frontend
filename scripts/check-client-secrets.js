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

let hasErrors = false;

function scanDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      // Skip app/api directory since it runs server-side
      const relativePath = path.relative(process.cwd(), fullPath).replace(/\\/g, '/');
      if (relativePath === 'app/api') {
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
  
  // Check for forbidden imports
  for (const forbidden of FORBIDDEN_IMPORTS) {
    const importRegex = new RegExp(`from\\s+['"\"]([^'\"\"]*${forbidden}[^'\"\"]*)['\"\"]`, 'i');
    if (importRegex.test(content)) {
      console.error(`❌ Error in ${relativePath}: Cannot import server-config in client/shared code.`);
      hasErrors = true;
    }
  }

  // Check for usage of secrets
  for (const secret of SECRETS) {
    const secretRegex = new RegExp(`process\\.env\\.${secret}\\b`);
    if (secretRegex.test(content)) {
      console.error(`❌ Error in ${relativePath}: Cannot reference secret process.env.${secret} in client/shared code.`);
      hasErrors = true;
    }
  }
}

console.log('🔍 Checking client-side code for server secrets and config leakage...');

const targetDirs = ['app', 'components', 'context', 'utils', 'constants', 'types'];

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
