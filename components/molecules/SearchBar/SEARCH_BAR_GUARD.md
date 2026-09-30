# SearchBar Guard Features

## Overview

The SearchBar component includes security and usability guard features to protect the backend from abuse and provide a better user experience.

## Features

### 1. Max Input Length
- **Default**: 200 characters (configurable via `maxLength` prop)
- Truncates input to stay within the limit
- Shows length hint (e.g., "150/200")
- Highlights near-max (amber) and at-max (red) states with color changes
- Disables the keyboard shortcut hint when near max length

### 2. Input Sanitization
Uses `sanitiseString` from `@/lib/security/input-sanitizer.ts` to:
- Normalize Unicode strings to NFC form
- Strip all control characters (including invisible and format characters)
- Prevents injection of malicious characters

### 3. Rate Guard (Debounce)
- Debounces search callbacks (default 300ms, configurable via `debounceDelay`)
- Prevents flooding the backend with rapid requests
- Still allows fast and responsive typing

## Usage

```tsx
// Basic usage with defaults
<SearchBar onSearch={handleSearch} />

// With custom max length
<SearchBar onSearch={handleSearch} maxLength={100} />

// With custom debounce
<SearchBar onSearch={handleSearch} debounceDelay={500} />
```

## Tests

Tests for these guard features are in:
- `SearchBar.test.tsx`: Existing comprehensive test suite
- `SearchBar.guard.test.tsx`: Guard-specific test cases including:
  - Max length truncation
  - Input sanitization
  - Rapid input handling
  - Edge cases (empty query, zero max length)

Run the tests with:
```bash
npm test -- SearchBar
```
