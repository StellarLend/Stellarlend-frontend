#!/usr/bin/env ts-node
import * as fs from 'fs';
import * as path from 'path';
import {
  SECRET_PATTERNS,
  SecretPattern,
  getPatternsBySeverity
} from '../lib/security/secret-patterns';

export interface SecretMatch {
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
export function scanFile(filePath: string, patterns: SecretPattern[]): SecretMatch[] {
  const matches: SecretMatch[] = [];

  let content: string;
  try {
    content = fs.readFileSync(filePath, 'utf8');
  } catch {
    // Binary or unreadable file — skip cleanly
    return matches;
  }

  const lines = content.split('\n');

  for (const pattern of patterns) {
    const regex = new RegExp(pattern.pattern.source, pattern.pattern.flags);
    regex.lastIndex = 0;

    let match;
    while ((match = regex.exec(content)) !== null) {
      // Skip false positives for AWS Secret Access Key (e.g. 40-char hex build/commit hashes)
      if (pattern.name === 'AWS Secret Access Key' && /^[0-9a-fA-F]{40}$/.test(match[0])) {
        continue;
      }

      const matchStart = match.index;
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
        severity: pattern.severity,
      });
    }
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

  const staticDir = path.join(process.cwd(), '.next', 'static');

  if (!fs.existsSync(staticDir)) {
    result.errors.push('.next/static directory not found. Run "npm run build" first.');
    return result;
  }

  const extensions = ['.js', '.json', '.css', '.txt', '.html'];

  console.log('🔍 Scanning client bundles for leaked secrets...');
  console.log(`📁 Target directory: ${staticDir}`);

  let files: string[];
  try {
    files = scanDirectory(staticDir, extensions);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    result.errors.push(`Failed to enumerate bundle files: ${message}`);
    return result;
  }

  result.filesScanned = files.length;
  console.log(`📄 Files to scan: ${result.filesScanned}`);

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
  console.log('Move secrets to server-side code (API routes, server components).');
  console.log('Use NEXT_PUBLIC_ prefix only for values safe to expose to clients.');
  console.log('Rebuild and rescan to verify the fix.');
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

// Run the scanner (skip when imported by tests)
if (process.env.VITEST !== 'true') {
  main();
}
