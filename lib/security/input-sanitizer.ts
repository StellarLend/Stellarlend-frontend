/**
 * Input sanitization utilities for free‑text profile fields.
 *
 * - Normalizes Unicode strings to NFC form.
 * - Strips all control characters (Unicode category Cc) and format characters (Cf).
 *   This removes invisible characters and bidi‑override marks.
 * - Provides a helper to sanitise an object record containing string fields.
 */

/** Strip control and format characters from a string and NFC‑normalize it. */
export function sanitiseString(input: string): string {
  // NFC normalisation first ensures composed characters are in canonical form.
  const normalized = input.normalize('NFC');
  // Remove control characters (C0/C1), zero-width and invisible Unicode characters,
  // and bidirectional override/isolate marks. Written as explicit ranges to avoid
  // reliance on Unicode property escapes (\p{C}), which requires a transpiler that
  // supports ES2018+ Unicode regex.
  return normalized.replace(
    // eslint-disable-next-line no-control-regex
    /[\u0000-\u001F\u007F-\u009F\u00AD\u200B-\u200F\u2028\u2029\u202A-\u202E\u2060-\u2064\u206A-\u206F\uFEFF\uFFF9-\uFFFC]/g,
    '',
  );
}

/**
 * Sanitise a record of string properties.
 * Only string values are processed; other types are left untouched.
 * This is used for profile data after Zod validation.
 */
export function sanitiseRecord<T extends Record<string, unknown>>(record: T): T {
  return Object.fromEntries(
    Object.entries(record).map(([key, value]) => [
      key,
      typeof value === 'string' ? sanitiseString(value) : value,
    ]),
  ) as T;
}
