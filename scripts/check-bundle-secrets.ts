#!/usr/bin/env ts-node
/**
 * Build-time client bundle secret scanner.
 *
 * The scanner is intentionally fail-closed: a missing build output or an
 * unreadable bundle is an operational failure, not a successful scan.
 */

import * as fs from 'fs';
import * as path from 'path';
import { SECRET_PATTERNS, SecretPattern } from '../lib/security/secret-patterns';

export interface SecretMatch {
  pattern: string;
  file: string;
  line: number;
  column: number;
  match: string;
  severity: string;
}

export interface ScanResult {
  matches: SecretMatch[];
  filesScanned: number;
  errors: string[];
}

export function scanDirectory(dir: string, extensions: string[]): string[] {
  if (!fs.existsSync(dir)) return [];

  const files: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...scanDirectory(fullPath, extensions));
    else if (entry.isFile() && extensions.includes(path.extname(entry.name).toLowerCase())) files.push(fullPath);
  }
  return files;
}

function locationOf(content: string, index: number): { line: number; column: number } {
  const before = content.slice(0, index);
  const lastNewline = before.lastIndexOf('\n');
  return {
    line: before.split('\n').length,
    column: index - lastNewline,
  };
}

export function scanFile(filePath: string, patterns: SecretPattern[]): { matches: SecretMatch[]; error?: string } {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const matches: SecretMatch[] = [];

    for (const pattern of patterns) {
      const regex = new RegExp(pattern.pattern.source, pattern.pattern.flags);
      let match: RegExpExecArray | null;
      while ((match = regex.exec(content)) !== null) {
        // Avoid treating common 40-character hexadecimal build/commit hashes as AWS keys.
        if (pattern.name === 'AWS Secret Access Key' && /^[0-9a-fA-F]{40}$/.test(match[0])) continue;
        const location = locationOf(content, match.index);
        matches.push({
          pattern: pattern.name,
          file: path.relative(process.cwd(), filePath),
          ...location,
          match: match[0],
          severity: pattern.severity,
        });
        if (!regex.global) break;
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
    return { matches };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { matches: [], error: `Unable to read bundle file ${path.relative(process.cwd(), filePath)}: ${message}` };
  }
}

export function scanBundles(staticDir = path.join(process.cwd(), '.next', 'static')): ScanResult {
  const result: ScanResult = { matches: [], filesScanned: 0, errors: [] };
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

  const files = scanDirectory(staticDir, ['.js', '.json', '.css', '.txt', '.html']);
  result.filesScanned = files.length;
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
    const scan = scanFile(file, SECRET_PATTERNS);
    result.matches.push(...scan.matches);
    if (scan.error) result.errors.push(scan.error);
  }

  return result;
}

function redactedMatch(match: string): string {
  return `[redacted ${match.length} chars]`;
}

export function displayResults(result: ScanResult): void {
  console.log('\n' + '='.repeat(80));
  console.log('SCAN RESULTS');
  console.log('='.repeat(80));
  console.log(`\n📊 Files scanned: ${result.filesScanned}`);
  console.log(`🔍 Secrets found: ${result.matches.length}`);

  if (result.errors.length) {
    console.error('\n❌ Scan errors:');
    result.errors.forEach((error) => console.error(`  - ${error}`));
  }

  for (const severity of ['critical', 'high', 'medium']) {
    const matches = result.matches.filter((match) => match.severity === severity);
    console.log(`\n${severity.toUpperCase()} SEVERITY`);
    if (!matches.length) console.log('  None');
    for (const match of matches) {
      console.log(`  - ${match.pattern} at ${match.file}:${match.line}:${match.column}`);
      console.log(`    Match: ${redactedMatch(match.match)}`);
    }
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('REMEDIATION');
  console.log('='.repeat(80));
  console.log('Move secrets to server-side code (API routes, server components).');
  console.log('Use NEXT_PUBLIC_ prefix only for values safe to expose to clients.');
  console.log('Rebuild and rescan to verify the fix.');
}

export function main(): number {
  console.log('🔍 Scanning client bundles for leaked secrets...');
  const result = scanBundles();
  displayResults(result);

  if (result.errors.length > 0) {
    console.error('\n❌ BUILD FAILED: Bundle scan could not complete safely.');
    return 1;
  }

  if (result.matches.some((match) => match.severity === 'critical' || match.severity === 'high')) {
    console.error('\n❌ BUILD FAILED: Critical or high severity secrets detected in client bundles.');
    return 1;
  }

  if (result.matches.some((match) => match.severity === 'medium')) {
    console.warn('\n⚠️ WARNING: Medium severity findings detected; review recommended.');
  }

  console.log('\n✅ Bundle secret verification completed successfully.');
  return 0;
}

if (require.main === module) process.exitCode = main();
// Run the scanner (skip when imported by tests)
if (process.env.VITEST !== 'true') {
  main();
}
