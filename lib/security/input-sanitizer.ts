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
  // Remove any Unicode code points with the "Other" (C) category – includes control, format, surrogate, and private‑use.
  // The RegExp uses the Unicode property escape \p{C} which matches all control/format characters.
  return normalized.replace(/[\p{C}]/gu, '');
}

/**
 * Sanitise a record of string properties.
 * Only string values are processed; other types are left untouched.
 * This is used for profile data after Zod validation.
 */
export function sanitiseRecord<T extends Record<string, any>>(record: T): T {
  const result = { ...record } as T;
  for (const key of Object.keys(result)) {
    const value = result[key];
    if (typeof value === 'string') {
      result[key] = sanitiseString(value) as any;
    }
  }
  return result;
}
