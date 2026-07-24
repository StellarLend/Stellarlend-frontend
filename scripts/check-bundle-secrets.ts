#!/usr/bin/env ts-node
/**
 * Build-Time Secret Scanner for Client Bundles
 * 
 * This script scans the .next/static output directory for leaked secrets
 * after the Next.js build process completes. It detects known secret patterns
 * and fails the build if any are found.
 * 
 * Usage: npm run check-bundle-secrets
 * Runs automatically after: npm run build
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  SECRET_PATTERNS,
  SecretPattern,
  getPatternsBySeverity
} from '../lib/security/secret-patterns';

interface SecretMatch {
  pattern: string;
  file: string;
  line: number;
  column: number;
  match: string;
  severity: string;
}

interface ScanResult {
  matches: SecretMatch[];
  filesScanned: number;
  errors: string[];
}

/**
 * Recursively scan a directory for files to check
 */
function scanDirectory(dir: string, extensions: string[]): string[] {
  const files: string[] = [];
  
  if (!fs.existsSync(dir)) {
    return files;
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    
    if (entry.isDirectory()) {
      files.push(...scanDirectory(fullPath, extensions));
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (extensions.includes(ext)) {
        files.push(fullPath);
      }
    }
  }
  
  return files;
}

/**
 * Scan a single file for secret patterns
 */
function scanFile(filePath: string, patterns: SecretPattern[]): SecretMatch[] {
  const matches: SecretMatch[] = [];
  
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    
    for (const pattern of patterns) {
      let match;
      const regex = new RegExp(pattern.pattern.source, pattern.pattern.flags);
      
      // Reset regex state
      regex.lastIndex = 0;
      
      while ((match = regex.exec(content)) !== null) {
        // Skip false positives for AWS Secret Access Key (e.g. 40-char hex build/commit hashes)
        if (pattern.name === 'AWS Secret Access Key' && /^[0-9a-fA-F]{40}$/.test(match[0])) {
          continue;
        }

        // Find line and column
        const matchStart = match.index;
        const matchEnd = match.index + match[0].length;
        
        let lineNum = 1;
        let columnNum = 1;
        let currentPos = 0;
        
        for (let i = 0; i < lines.length; i++) {
          const lineLength = lines[i].length + 1; // +1 for newline
          if (currentPos + lineLength > matchStart) {
            lineNum = i + 1;
            columnNum = matchStart - currentPos + 1;
            break;
          }
          currentPos += lineLength;
        }
        
        matches.push({
          pattern: pattern.name,
          file: path.relative(process.cwd(), filePath),
          line: lineNum,
          column: columnNum,
          match: match[0],
          severity: pattern.severity
        });
      }
    }
  } catch (error) {
    // Skip files that can't be read (e.g., binary files)
  }
  
  return matches;
}

/**
 * Main scan function
 */
function scanBundles(): ScanResult {
  const result: ScanResult = {
    matches: [],
    filesScanned: 0,
    errors: []
  };
  
  // Scan .next/static directory
  const staticDir = path.join(process.cwd(), '.next', 'static');
  
  if (!fs.existsSync(staticDir)) {
    result.errors.push('.next/static directory not found. Run "npm run build" first.');
    return result;
  }
  
  // File extensions to scan (JavaScript, JSON, CSS, etc.)
  const extensions = ['.js', '.json', '.css', '.txt', '.html'];
  
  console.log('🔍 Scanning client bundles for leaked secrets...');
  console.log(`📁 Target directory: ${staticDir}`);
  
  const files = scanDirectory(staticDir, extensions);
  result.filesScanned = files.length;
  
  console.log(`📄 Files to scan: ${result.filesScanned}`);
  
  // Scan each file
  for (const file of files) {
    const matches = scanFile(file, SECRET_PATTERNS);
    result.matches.push(...matches);
  }
  
  return result;
}

/**
 * Format and display scan results
 */
function displayResults(result: ScanResult): void {
  console.log('\n' + '='.repeat(80));
  console.log('SCAN RESULTS');
  console.log('='.repeat(80));
  
  if (result.errors.length > 0) {
    console.log('\n❌ Errors:');
    for (const error of result.errors) {
      console.log(`  - ${error}`);
    }
  }
  
  console.log(`\n📊 Files scanned: ${result.filesScanned}`);
  console.log(`🔍 Secrets found: ${result.matches.length}`);
  
  if (result.matches.length === 0) {
    console.log('\n✅ No secrets detected in client bundles.');
    return;
  }
  
  // Group matches by severity
  const criticalMatches = result.matches.filter(m => m.severity === 'critical');
  const highMatches = result.matches.filter(m => m.severity === 'high');
  const mediumMatches = result.matches.filter(m => m.severity === 'medium');
  
  console.log('\n' + '-'.repeat(80));
  console.log('CRITICAL SEVERITY');
  console.log('-'.repeat(80));
  
  if (criticalMatches.length > 0) {
    for (const match of criticalMatches) {
      console.log(`\n  🔴 ${match.pattern}`);
      console.log(`     File: ${match.file}:${match.line}:${match.column}`);
      console.log(`     Match: ${match.match.substring(0, 50)}${match.match.length > 50 ? '...' : ''}`);
    }
  } else {
    console.log('  None');
  }
  
  console.log('\n' + '-'.repeat(80));
  console.log('HIGH SEVERITY');
  console.log('-'.repeat(80));
  
  if (highMatches.length > 0) {
    for (const match of highMatches) {
      console.log(`\n  🟠 ${match.pattern}`);
      console.log(`     File: ${match.file}:${match.line}:${match.column}`);
      console.log(`     Match: ${match.match.substring(0, 50)}${match.match.length > 50 ? '...' : ''}`);
    }
  } else {
    console.log('  None');
  }
  
  console.log('\n' + '-'.repeat(80));
  console.log('MEDIUM SEVERITY');
  console.log('-'.repeat(80));
  
  if (mediumMatches.length > 0) {
    for (const match of mediumMatches) {
      console.log(`\n  🟡 ${match.pattern}`);
      console.log(`     File: ${match.file}:${match.line}:${match.column}`);
      console.log(`     Match: ${match.match.substring(0, 50)}${match.match.length > 50 ? '...' : ''}`);
    }
  } else {
    console.log('  None');
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('REMEDIATION');
  console.log('='.repeat(80));
  console.log(`
If secrets were detected in your client bundles:

1. Identify the source code that is importing or using the secret
2. Move the secret to server-side code (API routes, server components)
3. Use environment variables with NEXT_PUBLIC_ prefix only for public values
4. For server secrets, use them only in server-side code:
   - app/api/ routes
   - getServerSideProps / getStaticProps
   - Server components (marked with 'use server')
5. Rebuild and rescan to verify the fix

Common issues:
- Importing server-config.ts in client components
- Using process.env.SERVER_SECRET in client code
- Hardcoding API keys in shared utilities
`);
}

/**
 * Main execution
 */
function main(): void {
  const result = scanBundles();
  displayResults(result);
  
  // Fail build if critical or high severity secrets are found
  const hasCriticalOrHigh = result.matches.some(
    m => m.severity === 'critical' || m.severity === 'high'
  );
  
  if (hasCriticalOrHigh) {
    console.log('\n❌ BUILD FAILED: Critical or high severity secrets detected in client bundles.');
    console.log('Please remediate before deploying.\n');
    process.exit(1);
  }
  
  // Warn if medium severity secrets are found but don't fail
  const hasMedium = result.matches.some(m => m.severity === 'medium');
  if (hasMedium) {
    console.log('\n⚠️  WARNING: Medium severity secrets detected. Review recommended but build continuing.\n');
    process.exit(0);
  }
  
  process.exit(0);
}

// Run the scanner
main();
