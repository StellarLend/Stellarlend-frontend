import { describe, it, expect } from 'vitest';
import {
  NOTIFICATION_TYPES,
  parseNotificationType,
  type NotificationType,
} from './types';

describe('parseNotificationType', () => {
  it.each(NOTIFICATION_TYPES)('accepts the valid type %s', (type) => {
    expect(parseNotificationType(type)).toBe(type);
  });

  it.each([
    ['an unknown string', 'bogus'],
    ['a legacy value from a pre-enum column', 'urgent'],
    ['an empty string', ''],
    ['a non-string number', 42],
    ['null', null],
    ['undefined', undefined],
    ['an object', { type: 'error' }],
  ])('defaults %s to "info"', (_label, value) => {
    expect(parseNotificationType(value)).toBe('info');
  });

  it('returns a value assignable to NotificationType', () => {
    const parsed: NotificationType = parseNotificationType('nope');
    expect(parsed).toBe('info');
  });
});
