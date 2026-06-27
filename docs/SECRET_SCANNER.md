# Build-Time Secret Scanner for Client Bundles

## Overview

The secret scanner is a security tool that automatically detects leaked secrets in client-side bundles after the Next.js build process. It scans the `.next/static` output directory for known secret patterns and fails the build if critical or high-severity secrets are detected.

## Purpose

Even with proper `NEXT_PUBLIC_*` discipline, server secrets can accidentally be imported into client code via shared modules. The build-time scanner provides a safety net by inspecting the actual bundled output for leaked secrets before deployment.

## How It Works

1. **Build Process**: After `next build` completes, the scanner runs automatically
2. **Bundle Inspection**: Scans all files in `.next/static` directory (`.js`, `.json`, `.css`, `.txt`, `.html`)
3. **Pattern Matching**: Applies regex patterns to detect known secret formats
4. **Severity Assessment**: Classifies findings as critical, high, or medium severity
5. **Build Decision**: Fails build on critical/high secrets, warns on medium

## Detected Secret Patterns

### Critical Severity

- **Stellar Secret Keys**: S-prefixed 56-character base32 strings (e.g., `SAB5HGOYHONC7TQNMJNPSO3BQD7LH5FGI7QXMJEZJMQK3VYQRO7ZQ2Y7`)
- **AWS Access Key IDs**: AKIA/ASIA-prefixed 20-character strings (e.g., `AKIAIOSFODNN7EXAMPLE`)
- **AWS Secret Access Keys**: 40-character alphanumeric strings with special chars
- **Private Keys (PEM)**: PEM-encoded private key headers
- **Server Environment Variables**: Server-only env var names (e.g., `PRICE_ORACLE_API_KEY`, `AUTH_SIGNING_SECRET`)
- **Database Connection Strings**: Database URLs with credentials

### High Severity

- **JWT Tokens**: Three-part base64url-encoded tokens separated by dots
- **API Keys**: Generic API key patterns with common prefixes

### Medium Severity

- Currently no medium-severity patterns (reserved for future use)

## Usage

### Automatic Execution

The scanner runs automatically as part of the build process:

```bash
npm run build
```

This executes:
1. `npm run check-secrets` (source code scanner)
2. `next build`
3. `npm run check-bundle-secrets` (bundle scanner)

### Manual Execution

You can run the scanner manually without building:

```bash
npm run check-bundle-secrets
```

### CI/CD Integration

The scanner is integrated into the GitHub Actions build workflow (`.github/workflows/build.yml`):

```yaml
- name: Build application
  run: npm run build

- name: Scan bundles for leaked secrets
  run: npm run check-bundle-secrets
```

## Output Format

### Success (No Secrets)

```
================================================================================
SCAN RESULTS
================================================================================

📁 Target directory: /path/to/.next/static
📄 Files to scan: 150

📊 Files scanned: 150
🔍 Secrets found: 0

✅ No secrets detected in client bundles.
```

### Failure (Secrets Detected)

```
================================================================================
SCAN RESULTS
================================================================================

📁 Target directory: /path/to/.next/static
📄 Files to scan: 150

📊 Files scanned: 150
🔍 Secrets found: 3

--------------------------------------------------------------------------------
CRITICAL SEVERITY
--------------------------------------------------------------------------------

  🔴 Stellar Secret Key
     File: .next/static/chunks/main-12345.js:42:15
     Match: SAB5HGOYHONC7TQNMJNPSO3BQD7LH5FGI7QXMJEZJMQK3VYQRO7ZQ2Y7

  🔴 Server Environment Variable
     File: .next/static/chunks/pages-67890.js:128:10
     Match: PRICE_ORACLE_API_KEY

--------------------------------------------------------------------------------
HIGH SEVERITY
--------------------------------------------------------------------------------

  🟠 JWT Token
     File: .next/static/chunks/auth-abcde.js:56:20
     Match: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM...

--------------------------------------------------------------------------------
MEDIUM SEVERITY
--------------------------------------------------------------------------------
  None

================================================================================
REMEDIATION
================================================================================

If secrets were detected in your client bundles:

1. Identify the source code that is importing or using the secret
2. Move the secret to server-side code (API routes, server components)
3. Use environment variables with NEXT_PUBLIC_ prefix only for public values
4. For server secrets, use them only in server-side code:
   - app/api/ routes
   - getServerSideProps / getStaticProps
   - Server components (marked with 'use server')
5. Rebuild and rescan to verify the fix

❌ BUILD FAILED: Critical or high severity secrets detected in client bundles.
Please remediate before deploying.
```

## Remediation Guide

### Common Issues and Solutions

#### 1. Server Environment Variables in Client Code

**Problem**: `PRICE_ORACLE_API_KEY` found in client bundle

**Solution**:
- Remove direct references to server env vars in client components
- Move logic to API routes (`app/api/`)
- Use API routes to proxy requests that need server secrets

```typescript
// ❌ WRONG - Client component
export default function PriceDisplay() {
  const apiKey = process.env.PRICE_ORACLE_API_KEY; // Leaked!
  // ...
}

// ✅ CORRECT - API route
// app/api/prices/route.ts
export async function GET() {
  const apiKey = process.env.PRICE_ORACLE_API_KEY; // Server-side only
  // ...
}

// ✅ CORRECT - Client component
export default function PriceDisplay() {
  const { data } = useSWR('/api/prices'); // No secrets in client
  // ...
}
```

#### 2. Importing Server Config in Client Code

**Problem**: `lib/server-config` imported in client component

**Solution**:
- Remove imports of `lib/server-config` from client components
- Create separate client-safe config files
- Use API routes for server-side configuration access

```typescript
// ❌ WRONG
import { serverConfig } from '@/lib/server-config';

// ✅ CORRECT
import { clientConfig } from '@/lib/client-config';
```

#### 3. Hardcoded Secrets

**Problem**: API keys or tokens hardcoded in source code

**Solution**:
- Move secrets to environment variables
- Use server-side code for secret access
- Never commit secrets to version control

```typescript
// ❌ WRONG
const API_KEY = 'sk-1234567890abcdef';

// ✅ CORRECT - Server-side
const API_KEY = process.env.API_KEY;
```

#### 4. Stellar Secret Keys in Client Code

**Problem**: Stellar secret key (S-prefixed) in client bundle

**Solution**:
- Never include Stellar secret keys in client-side code
- Use Stellar SDK's server-side signing
- Keep secret keys on server, only public keys on client

```typescript
// ❌ WRONG
const secretKey = 'SAB5HGOYHONC7TQNMJNPSO3BQD7LH5FGI7QXMJEZJMQK3VYQRO7ZQ2Y7';

// ✅ CORRECT - Server-side
const secretKey = process.env.STELLAR_SECRET_KEY;
```

## Testing

### Unit Tests

Pattern detection accuracy is tested in `lib/security/secret-patterns.test.ts`:

```bash
npm test -- lib/security/secret-patterns.test.ts
```

Tests cover:
- Valid secret detection
- False positive prevention
- Pattern validation
- Severity classification

### Integration Testing

To test the scanner with actual bundles:

```bash
# Build the application
npm run build

# The scanner runs automatically
# Check output for any detected secrets
```

## Configuration

### Adding New Patterns

To add new secret patterns, edit `lib/security/secret-patterns.ts`:

```typescript
export const NEW_PATTERN: SecretPattern = {
  name: 'New Secret Type',
  pattern: /your-regex-pattern/g,
  description: 'Description of what this pattern detects',
  severity: 'critical', // or 'high' or 'medium'
  examples: ['example1', 'example2']
};

// Add to SECRET_PATTERNS array
export const SECRET_PATTERNS: SecretPattern[] = [
  // ... existing patterns
  NEW_PATTERN
];
```

### Adjusting Severity

To change the severity of a pattern:

1. Edit the pattern's `severity` field in `lib/security/secret-patterns.ts`
2. Update unit tests if needed
3. Test the changes

### Excluding Files

Currently, the scanner checks all files in `.next/static` with extensions: `.js`, `.json`, `.css`, `.txt`, `.html`

To exclude specific file types, edit `scripts/check-bundle-secrets.ts`:

```typescript
const extensions = ['.js', '.json']; // Remove unwanted extensions
```

## Security Considerations

### False Positives

The scanner is designed to minimize false positives, but they can occur:

- **Stellar keys**: May flag strings starting with 'S' followed by 55 chars
- **JWT tokens**: May flag similar-looking base64 strings
- **API keys**: May flag long alphanumeric strings with certain prefixes

If you encounter false positives:
1. Review the pattern and adjust regex if needed
2. Consider if the string should be in the client bundle at all
3. Move sensitive data to server-side if possible

### False Negatives

The scanner may miss:
- Custom secret formats not in the pattern list
- Obfuscated or encoded secrets
- Secrets split across multiple lines

To improve detection:
1. Add custom patterns for your specific secrets
2. Use additional security tools (e.g., git-secrets, truffleHog)
3. Implement code review processes for secret handling

### Performance

The scanner is designed to be fast:
- Scans only `.next/static` directory (not node_modules)
- Uses efficient regex patterns
- Processes files in parallel where possible

Typical scan time: 1-3 seconds for a production build.

## Troubleshooting

### Scanner Fails with ".next/static not found"

**Cause**: Build hasn't been run yet

**Solution**: Run `npm run build` first

### Scanner Detects Secrets You Believe Are Safe

**Cause**: Pattern match may be a false positive

**Solution**:
1. Verify the matched string is not actually a secret
2. If it's a false positive, consider adjusting the pattern
3. If it's sensitive data, move it to server-side code

### Scanner Takes Too Long

**Cause**: Large build output or many files

**Solution**:
1. Check if `.next/static` has unexpected files
2. Consider optimizing bundle size
3. Review Next.js build configuration

## Related Tools

- **Source Code Scanner**: `scripts/check-client-secrets.js` - Checks source code for secrets
- **Git Hooks**: Pre-commit hooks can prevent secrets from being committed
- **Environment Validation**: `lib/configValidation.ts` - Validates environment configuration

## Contributing

When adding new secret patterns:

1. Add the pattern to `lib/security/secret-patterns.ts`
2. Add comprehensive unit tests in `lib/security/secret-patterns.test.ts`
3. Test with real-world examples
4. Update this documentation
5. Ensure pattern doesn't cause excessive false positives

## References

- [Stellar SDK Documentation](https://stellar.github.io/js-stellar-sdk/)
- [Next.js Environment Variables](https://nextjs.org/docs/basic-features/environment-variables)
- [OWASP Secret Scanning](https://owasp.org/www-community/Secrets_Detection)
- [AWS Security Best Practices](https://docs.aws.amazon.com/general/latest/gr/aws-security-best-practices.html)
