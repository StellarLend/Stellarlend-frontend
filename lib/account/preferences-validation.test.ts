import { describe, it, expect } from 'vitest';
import {
  validatePreferences,
  preferencesSchema,
  localeSchema,
  displayCurrencySchema,
} from './preferences-validation';

describe('validatePreferences', () => {
  const validPreferences = {
    email: 'alice@example.com',
    locale: 'en-US',
    displayCurrency: 'USD',
    notifications: { email: true, push: true, sms: false, inApp: true },
  };

  it('accepts a fully valid payload', () => {
    const result = validatePreferences(validPreferences);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual(validPreferences);
    }
  });

  it('accepts an empty payload and applies defaults', () => {
    const result = validatePreferences({});

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.locale).toBe('en-US');
      expect(result.data.displayCurrency).toBe('USD');
      expect(result.data.notifications.email).toBe(true);
      expect(result.data.notifications.push).toBe(true);
      expect(result.data.notifications.sms).toBe(false);
      expect(result.data.notifications.inApp).toBe(true);
    }
  });

  it('rejects an invalid email', () => {
    const result = validatePreferences({ ...validPreferences, email: 'not-an-email' });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.email).toBe('Invalid email address');
    }
  });

  it('rejects an unsupported locale', () => {
    const result = validatePreferences({ ...validPreferences, locale: 'xx-XX' });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.locale).toBeTruthy();
    }
  });

  it('rejects an unsupported displayCurrency', () => {
    const result = validatePreferences({ ...validPreferences, displayCurrency: 'XYZ' });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.displayCurrency).toBeTruthy();
    }
  });

  it('rejects invalid notification channel values', () => {
    const result = validatePreferences({
      ...validPreferences,
      notifications: { ...validPreferences.notifications, email: 'yes' },
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors['notifications.email']).toBeTruthy();
    }
  });

  it('returns a generic error key for malformed input without a path', () => {
    const result = validatePreferences(null);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(Object.keys(result.errors).length).toBeGreaterThan(0);
    }
  });
});

describe('preferencesSchema', () => {
  it('defaults notifications when undefined', () => {
    const parsed = preferencesSchema.parse({
      email: 'alice@example.com',
      locale: 'en-US',
      displayCurrency: 'USD',
    });

    expect(parsed.notifications).toEqual({ email: true, push: true, sms: false, inApp: true });
  });

  it('defaults locale and displayCurrency when undefined', () => {
    const parsed = preferencesSchema.parse({ email: 'alice@example.com' });

    expect(parsed.locale).toBe('en-US');
    expect(parsed.displayCurrency).toBe('USD');
  });
});

describe('localeSchema', () => {
  it('accepts supported locales', () => {
    expect(localeSchema.safeParse('en-US').success).toBe(true);
    expect(localeSchema.safeParse('de-DE').success).toBe(true);
  });

  it('rejects unsupported locales', () => {
    expect(localeSchema.safeParse('xx-XX').success).toBe(false);
  });
});

describe('displayCurrencySchema', () => {
  it('accepts supported currencies', () => {
    expect(displayCurrencySchema.safeParse('USD').success).toBe(true);
    expect(displayCurrencySchema.safeParse('EUR').success).toBe(true);
  });

  it('rejects unsupported currencies', () => {
    expect(displayCurrencySchema.safeParse('XYZ').success).toBe(false);
  });
});
