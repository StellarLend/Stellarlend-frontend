/**
 * Unit Tests for Secret Pattern Detection
 * 
 * Tests the accuracy and reliability of secret pattern detection
 * to ensure we catch real secrets while minimizing false positives.
 */

import { describe, it, expect } from 'vitest';
import {
  SECRET_PATTERNS,
  STELLAR_SECRET_KEY_PATTERN,
  JWT_PATTERN,
  AWS_ACCESS_KEY_PATTERN,
  AWS_SECRET_KEY_PATTERN,
  API_KEY_PATTERN,
  PRIVATE_KEY_PATTERN,
  SERVER_ENV_PATTERN,
  DATABASE_URL_PATTERN,
  getPatternsBySeverity,
  validatePattern
} from './secret-patterns';

describe('Secret Pattern Detection', () => {
  describe('Stellar Secret Key Pattern', () => {
    it('should detect valid Stellar secret keys', () => {
      const validKeys = [
        'SAB5HGOYHONC7TQNMJNPSO3BQD7LH5FGI7QXMJEZJMQK3VYQRO7ZQ2Y7',
        'SC5S7AIE5M2ZQ5Q2Y7ZQ2Y7ZQ2Y7ZQ2Y7ZQ2Y7ZQ2Y7ZQ2Y7ZQ2Y7ZQ2Y7'
      ];
      
      for (const key of validKeys) {
        const matches = key.match(STELLAR_SECRET_KEY_PATTERN.pattern);
        expect(matches).toBeTruthy();
        expect(matches?.[0]).toBe(key);
      }
    });

    it('should not detect invalid Stellar secret keys', () => {
      const invalidKeys = [
        'SAB5HGOYHONC7TQNMJNPSO3BQD7LH5FGI7QXMJEZJMQK3VYQRO7ZQ2', // Too short (55 chars)
        'XAB5HGOYHONC7TQNMJNPSO3BQD7LH5FGI7QXMJEZJMQK3VYQRO7ZQ2Y7', // Wrong prefix
        'SAB5HGOYHONC7TQNMJNPSO3BQD7LH5FGI7QXMJEZJMQK3VYQRO7ZQ2Y7!', // Invalid char
        'stellar-secret-key' // Not a key
      ];
      
      for (const key of invalidKeys) {
        const matches = key.match(STELLAR_SECRET_KEY_PATTERN.pattern);
        expect(matches).toBeNull();
      }
    });
  });

  describe('JWT Pattern', () => {
    it('should detect valid JWT tokens', () => {
      const validJWTs = [
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
        'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyIjoiMTIzIn0.signature'
      ];
      
      for (const jwt of validJWTs) {
        const matches = jwt.match(JWT_PATTERN.pattern);
        expect(matches).toBeTruthy();
        expect(matches?.[0]).toBe(jwt);
      }
    });

    it('should not detect invalid JWT tokens', () => {
      const invalidJWTs = [
        'not.a.jwt', // Too short
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9', // Only one part
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ', // Only two parts
        'random-string' // Not a JWT
      ];
      
      for (const jwt of invalidJWTs) {
        const matches = jwt.match(JWT_PATTERN.pattern);
        expect(matches).toBeNull();
      }
    });
  });

  describe('AWS Access Key Pattern', () => {
    it('should detect valid AWS access keys', () => {
      const validKeys = [
        'AKIAIOSFODNN7EXAMPLE',
        'AKIAI44QH8DHBEXAMPLE',
        'ASIAQEXAMPLE12345678'
      ];
      
      for (const key of validKeys) {
        const matches = key.match(AWS_ACCESS_KEY_PATTERN.pattern);
        expect(matches).toBeTruthy();
        expect(matches?.[0]).toBe(key);
      }
    });

    it('should not detect invalid AWS access keys', () => {
      const invalidKeys = [
        'AKIAIOSFODNN7EXAMPL', // Too short (16 chars)
        'AKIAIOSFODNN7EXAMPLE123', // Too long (20 chars)
        'XKIAIOSFODNN7EXAMPLE', // Wrong prefix
        'akiaiosfodnn7example', // Lowercase
        'AWS-KEY-12345' // Not an AWS key format
      ];
      
      for (const key of invalidKeys) {
        const matches = key.match(AWS_ACCESS_KEY_PATTERN.pattern);
        expect(matches).toBeNull();
      }
    });
  });

  describe('AWS Secret Key Pattern', () => {
    it('should detect valid AWS secret keys', () => {
      const validKeys = [
        'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
        'ABCD1234EFGH5678IJKL9012MNOP3456QRST7890'
      ];
      
      for (const key of validKeys) {
        const matches = key.match(AWS_SECRET_KEY_PATTERN.pattern);
        expect(matches).toBeTruthy();
        expect(matches?.[0]).toBe(key);
      }
    });

    it('should not detect invalid AWS secret keys', () => {
      const invalidKeys = [
        'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKE', // Too short (39 chars)
        'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY123', // Too long (41 chars)
        'short-key', // Too short
        'key-with-spaces' // Contains spaces
      ];
      
      for (const key of invalidKeys) {
        const matches = key.match(AWS_SECRET_KEY_PATTERN.pattern);
        expect(matches).toBeNull();
      }
    });
  });

  describe('API Key Pattern', () => {
    it('should detect API key declarations', () => {
      const validDeclarations = [
        'api_key=abc123def456ghi789jkl012mno345pqr678',
        'apikey=xyz789abc123def456ghi789jkl012mno345',
        'secret-key=lmn345opq678rst901uvw234xyz567abc890',
        'API_KEY: "abc123def456ghi789jkl012mno345pqr678"',
        'secret_key = "xyz789abc123def456ghi789jkl012mno345"'
      ];
      
      for (const decl of validDeclarations) {
        const matches = decl.match(API_KEY_PATTERN.pattern);
        expect(matches).toBeTruthy();
      }
    });

    it('should not detect non-API key strings', () => {
      const invalidDeclarations = [
        'api_key=short', // Too short
        'public_key=abc123', // Not a secret pattern
        'const apiKey = userProvidedKey', // Variable name, not value
        'api_key_placeholder' // Placeholder
      ];
      
      for (const decl of invalidDeclarations) {
        const matches = decl.match(API_KEY_PATTERN.pattern);
        expect(matches).toBeNull();
      }
    });
  });

  describe('Private Key Pattern', () => {
    it('should detect PEM private key headers', () => {
      const validHeaders = [
        '-----BEGIN PRIVATE KEY-----',
        '-----BEGIN RSA PRIVATE KEY-----',
        '-----BEGIN EC PRIVATE KEY-----'
      ];
      
      for (const header of validHeaders) {
        const matches = header.match(PRIVATE_KEY_PATTERN.pattern);
        expect(matches).toBeTruthy();
        expect(matches?.[0]).toBe(header);
      }
    });

    it('should not detect non-private-key strings', () => {
      const invalidStrings = [
        '-----BEGIN PUBLIC KEY-----', // Public key, not private
        'private key', // Not PEM format
        'BEGIN PRIVATE KEY', // Missing dashes
        '-----BEGIN CERTIFICATE-----' // Certificate, not private key
      ];
      
      for (const str of invalidStrings) {
        const matches = str.match(PRIVATE_KEY_PATTERN.pattern);
        expect(matches).toBeNull();
      }
    });
  });

  describe('Server Environment Variable Pattern', () => {
    it('should detect server-only environment variable names', () => {
      const validNames = [
        'PRICE_ORACLE_API_KEY',
        'AUTH_SIGNING_SECRET',
        'SERVER_TOKEN'
      ];
      
      for (const name of validNames) {
        const matches = name.match(SERVER_ENV_PATTERN.pattern);
        expect(matches).toBeTruthy();
        expect(matches?.[0]).toBe(name);
      }
    });

    it('should not detect public environment variable names', () => {
      const invalidNames = [
        'NEXT_PUBLIC_API_KEY',
        'NEXT_PUBLIC_APP_NAME',
        'PUBLIC_VAR',
        'NEXT_PUBLIC_PRICE_ORACLE_API_KEY' // Public version
      ];
      
      for (const name of invalidNames) {
        const matches = name.match(SERVER_ENV_PATTERN.pattern);
        expect(matches).toBeNull();
      }
    });
  });

  describe('Database URL Pattern', () => {
    it('should detect database connection strings', () => {
      const validURLs = [
        'postgresql://user:pass@localhost:5432/mydb',
        'postgres://user:password@host.example.com:5432/database',
        'mongodb://user:pass@localhost:27017/mydb',
        'redis://:password@localhost:6379/0'
      ];
      
      for (const url of validURLs) {
        const matches = url.match(DATABASE_URL_PATTERN.pattern);
        expect(matches).toBeTruthy();
        expect(matches?.[0]).toBe(url);
      }
    });

    it('should not detect non-database URLs', () => {
      const invalidURLs = [
        'https://example.com',
        'http://localhost:3000',
        'ftp://files.example.com',
        'ws://localhost:8080'
      ];
      
      for (const url of invalidURLs) {
        const matches = url.match(DATABASE_URL_PATTERN.pattern);
        expect(matches).toBeNull();
      }
    });
  });

  describe('Pattern Utility Functions', () => {
    it('should filter patterns by severity', () => {
      const criticalPatterns = getPatternsBySeverity('critical');
      const highPatterns = getPatternsBySeverity('high');
      const mediumPatterns = getPatternsBySeverity('medium');
      
      expect(criticalPatterns.length).toBeGreaterThan(0);
      expect(highPatterns.length).toBeGreaterThan(0);
      expect(mediumPatterns.length).toBe(0); // No medium patterns currently
      
      criticalPatterns.forEach(p => expect(p.severity).toBe('critical'));
      highPatterns.forEach(p => expect(p.severity).toBe('high'));
    });

    it('should validate all patterns', () => {
      SECRET_PATTERNS.forEach(pattern => {
        expect(validatePattern(pattern)).toBe(true);
      });
    });

    it('should have unique pattern names', () => {
      const names = SECRET_PATTERNS.map(p => p.name);
      const uniqueNames = new Set(names);
      expect(names.length).toBe(uniqueNames.size);
    });
  });

  describe('Pattern Coverage', () => {
    it('should include all required pattern types', () => {
      const patternNames = SECRET_PATTERNS.map(p => p.name);
      
      expect(patternNames).toContain('Stellar Secret Key');
      expect(patternNames).toContain('JWT Token');
      expect(patternNames).toContain('AWS Access Key ID');
      expect(patternNames).toContain('AWS Secret Access Key');
      expect(patternNames).toContain('API Key');
      expect(patternNames).toContain('Private Key (PEM)');
      expect(patternNames).toContain('Server Environment Variable');
      expect(patternNames).toContain('Database Connection String');
    });

    it('should have severity levels for all patterns', () => {
      SECRET_PATTERNS.forEach(pattern => {
        expect(['critical', 'high', 'medium']).toContain(pattern.severity);
      });
    });

    it('should have descriptions for all patterns', () => {
      SECRET_PATTERNS.forEach(pattern => {
        expect(pattern.description).toBeTruthy();
        expect(pattern.description.length).toBeGreaterThan(0);
      });
    });

    it('should have examples for all patterns', () => {
      SECRET_PATTERNS.forEach(pattern => {
        expect(pattern.examples).toBeTruthy();
        expect(pattern.examples.length).toBeGreaterThan(0);
      });
    });
  });

  describe('False Positive Prevention', () => {
    it('should not flag common safe strings', () => {
      const safeStrings = [
        'const apiKey = process.env.NEXT_PUBLIC_API_KEY',
        'export const STELLAR_NETWORK = "testnet"',
        'const token = userSession.token',
        'const secret = userProvidedSecret',
        'database: "my-database"',
        'key: "value"',
        'S3://bucket/path', // S3 URL, not Stellar key
        'ASAP', // Not AWS key
        'JWT: token', // Not actual JWT
        'BEGIN', // Not PEM header
        'PRICE_ORACLE_API_KEY_PLACEHOLDER' // Placeholder
      ];
      
      for (const str of safeStrings) {
        let hasMatch = false;
        for (const pattern of SECRET_PATTERNS) {
          if (pattern.pattern.test(str)) {
            hasMatch = true;
            break;
          }
        }
        expect(hasMatch).toBe(false);
      }
    });
  });
});
