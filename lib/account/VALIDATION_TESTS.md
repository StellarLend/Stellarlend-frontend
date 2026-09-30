# Validation Tests — `lib/account/validation.ts`

## Overview

Unit tests for the `validateProfile` function and `profileSchema` Zod schema that
validate and sanitise account profile fields (`displayName`, `bio`, `website`,
`timezone`).

## Test structure

```
describe("validateProfile")
  describe("Valid payloads")
    ✓ accepts minimal valid payload (displayName only)
    ✓ accepts all fields provided
    ✓ trims whitespace from displayName and bio
    ✓ defaults bio to empty string when omitted
    ✓ defaults website to empty string when omitted
    ✓ defaults timezone to UTC when omitted
    ✓ accepts empty bio explicitly
    ✓ accepts empty website explicitly
    ✓ accepts displayName at max length (80 chars)
    ✓ accepts bio at max length (500 chars)
    ✓ accepts website at max length (200 chars)
    ✓ accepts timezone at max length (60 chars)
    ✓ accepts unicode display names
    ✓ strips control characters via sanitisation
    ✓ normalises unicode to NFC form
    ✓ silently excludes unknown keys (Zod strip mode)

  describe("Invalid payloads")
    ✓ rejects missing displayName
    ✓ rejects displayName that is only whitespace
    ✓ rejects displayName exceeding max length
    ✓ rejects bio exceeding max length
    ✓ rejects invalid website URL
    ✓ rejects website exceeding max length
    ✓ rejects timezone exceeding max length
    ✓ rejects non-string displayName
    ✓ rejects null input
    ✓ rejects undefined input
    ✓ rejects array input
    ✓ reports first-path error key for each invalid field
    ✓ does not include unknown keys in error output

describe("profileSchema (direct Zod schema)")
    ✓ accepts a valid object
    ✓ strips unknown keys
```

## Schema detail

| Field         | Type   | Required | Constraints                        |
|---------------|--------|----------|------------------------------------|
| `displayName` | string | yes      | 1–80 chars, trimmed                |
| `bio`         | string | no       | max 500 chars, trimmed, default `""` |
| `website`     | string | no       | valid URL or `""`, max 200 chars, default `""` |
| `timezone`    | string | no       | max 60 chars, default `"UTC"`      |

After Zod validation, all string fields are additionally sanitised by
`sanitiseRecord` (NFC normalisation + control-character stripping).

## Key assertions

### Valid
- Every required field is present after parse.
- Default values are applied for omitted optional fields.
- `displayName` and `bio` are whitespace-trimmed.
- Control characters (Unicode category `C`) are stripped by `sanitiseRecord`.
- Unicode is normalised to NFC form.
- Unknown (extra) keys are silently dropped (Zod default `strip` mode).

### Invalid
- Each field has a descriptive error message matching the schema definition.
- Boundary conditions (max lengths) produce the correct error.
- Non-object inputs (`null`, `undefined`, arrays) are rejected.
- Multiple field errors are reported simultaneously in the `errors` map.

## Coverage targets

| Category   | Target  |
|------------|---------|
| Lines      | ≥ 95 %  |
| Functions  | ≥ 95 %  |
| Branches   | ≥ 90 %  |

## Running

```bash
# Run all tests
npm test

# Run only validation tests
npx vitest run --project server-unit lib/account/__tests__/validation.test.ts

# With coverage
npx vitest run --project server-unit --coverage lib/account/__tests__/validation.test.ts
```
