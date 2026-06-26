/**
 * Secret Pattern Definitions for Bundle Scanner
 * 
 * This module defines regex patterns for detecting leaked secrets in client bundles.
 * Patterns are designed to minimize false positives while catching real security issues.
 */

export interface SecretPattern {
  name: string;
  pattern: RegExp;
  description: string;
  severity: 'critical' | 'high' | 'medium';
  examples: string[];
}

/**
 * Stellar secret key pattern
 * Stellar secret keys start with 'S' followed by 55 base32 characters (56 total)
 */
export const STELLAR_SECRET_KEY_PATTERN: SecretPattern = {
  name: 'Stellar Secret Key',
  pattern: /S[A-Z2-7]{55}/g,
  description: 'Stellar secret key (S-prefixed 56 character base32 string)',
  severity: 'critical',
  examples: ['SAB... (56 chars)', 'SC5... (56 chars)']
};

/**
 * JWT token pattern
 * JWT tokens have three parts separated by dots, each part is base64url encoded
 */
export const JWT_PATTERN: SecretPattern = {
  name: 'JWT Token',
  pattern: /eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/g,
  description: 'JSON Web Token (three base64url-encoded parts separated by dots)',
  severity: 'high',
  examples: ['eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c']
};

/**
 * AWS Access Key ID pattern
 * AWS access keys start with specific prefixes (AKIA, ASIA) followed by alphanumeric characters
 */
export const AWS_ACCESS_KEY_PATTERN: SecretPattern = {
  name: 'AWS Access Key ID',
  pattern: /(?:AKIA|ASIA)[A-Z0-9]{16}/g,
  description: 'AWS Access Key ID (AKIA or ASIA prefix followed by 16 characters)',
  severity: 'critical',
  examples: ['AKIAIOSFODNN7EXAMPLE', 'ASIAQEXAMPLE12345678']
};

/**
 * AWS Secret Access Key pattern
 * AWS secret keys are 40 characters long, can contain letters, numbers, and +/=
 */
export const AWS_SECRET_KEY_PATTERN: SecretPattern = {
  name: 'AWS Secret Access Key',
  pattern: /[A-Za-z0-9/+=]{40}/g,
  description: 'AWS Secret Access Key (40 character alphanumeric string with special chars)',
  severity: 'critical',
  examples: ['wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY']
};

/**
 * Generic API Key pattern
 * Common API key formats with various prefixes
 */
export const API_KEY_PATTERN: SecretPattern = {
  name: 'API Key',
  pattern: /(?:api[_-]?key|apikey|secret[_-]?key)\s*[:=]\s*['"]?[A-Za-z0-9_\-]{20,}['"]?/gi,
  description: 'Generic API key pattern (common prefixes with long alphanumeric values)',
  severity: 'high',
  examples: ['api_key=abc123...', 'secret-key=xyz789...']
};

/**
 * Private key pattern (PEM format)
 * Detects PEM-encoded private keys
 */
export const PRIVATE_KEY_PATTERN: SecretPattern = {
  name: 'Private Key (PEM)',
  pattern: /-----BEGIN\s+(?:RSA\s+)?PRIVATE\s+KEY-----/g,
  description: 'PEM-encoded private key header',
  severity: 'critical',
  examples: ['-----BEGIN PRIVATE KEY-----', '-----BEGIN RSA PRIVATE KEY-----']
};

/**
 * Server environment variable pattern
 * Detects references to server-only environment variables in bundles
 */
export const SERVER_ENV_PATTERN: SecretPattern = {
  name: 'Server Environment Variable',
  pattern: /(?:PRICE_ORACLE_API_KEY|AUTH_SIGNING_SECRET|SERVER_TOKEN)/g,
  description: 'Server-only environment variable names',
  severity: 'critical',
  examples: ['PRICE_ORACLE_API_KEY', 'AUTH_SIGNING_SECRET', 'SERVER_TOKEN']
};

/**
 * Database connection string pattern
 * Detects database connection strings
 */
export const DATABASE_URL_PATTERN: SecretPattern = {
  name: 'Database Connection String',
  pattern: /(?:postgresql|postgres|mysql|mongodb|redis):\/\/[^\s'"`]+/gi,
  description: 'Database connection string with credentials',
  severity: 'critical',
  examples: ['postgresql://user:pass@host:5432/db', 'mongodb://user:pass@host:27017/db']
};

/**
 * All secret patterns to scan for
 */
export const SECRET_PATTERNS: SecretPattern[] = [
  STELLAR_SECRET_KEY_PATTERN,
  JWT_PATTERN,
  AWS_ACCESS_KEY_PATTERN,
  AWS_SECRET_KEY_PATTERN,
  API_KEY_PATTERN,
  PRIVATE_KEY_PATTERN,
  SERVER_ENV_PATTERN,
  DATABASE_URL_PATTERN
];

/**
 * Get patterns by severity level
 */
export function getPatternsBySeverity(severity: 'critical' | 'high' | 'medium'): SecretPattern[] {
  return SECRET_PATTERNS.filter(p => p.severity === severity);
}

/**
 * Validate a pattern to ensure it's properly formatted
 */
export function validatePattern(pattern: SecretPattern): boolean {
  try {
    // Test the pattern with a simple string to ensure it's valid
    pattern.pattern.test('');
    return true;
  } catch (error) {
    return false;
  }
}
