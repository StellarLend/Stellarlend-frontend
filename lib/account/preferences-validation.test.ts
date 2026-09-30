import { describe, it, expect } from 'vitest';
import { validatePreferences } from './preferences-validation';

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
