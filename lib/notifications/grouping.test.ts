import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  getDateGroup,
  getDateGroupLabel,
  groupNotifications,
  sortGroupedNotifications,
} from './grouping';
import type { Notification } from './types';

function notification(id: string, createdAt: string): Notification {
  return {
    id,
    userId: 'user-1',
    title: `Notification ${id}`,
    message: `Message ${id}`,
    read: false,
    createdAt,
    type: 'info',
  };
}

describe('notification grouping', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('buckets notifications into today, earlier this week, and older', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 22, 12));

    expect(getDateGroup(new Date(2026, 6, 22, 0))).toBe('today');
    expect(getDateGroup(new Date(2026, 6, 21, 23, 59, 59))).toBe(
      'earlier_this_week',
    );
    expect(getDateGroup(new Date(2026, 6, 19, 23, 59, 59))).toBe('older');
  });

  it('treats Monday as the beginning of the current week', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 26, 12));

    expect(getDateGroup(new Date(2026, 6, 20, 0))).toBe(
      'earlier_this_week',
    );
    expect(getDateGroup(new Date(2026, 6, 19, 23, 59, 59))).toBe('older');
  });

  it('separates pinned notifications from date buckets', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-22T12:00:00.000Z'));

    const grouped = groupNotifications(
      [
        notification('pinned-old', '2026-07-01T09:00:00.000Z'),
        notification('today', '2026-07-22T10:00:00.000Z'),
        notification('week', '2026-07-21T10:00:00.000Z'),
        notification('old', '2026-07-10T10:00:00.000Z'),
      ],
      new Set(['pinned-old']),
    );

    expect(grouped.pinned.map((item) => item.id)).toEqual(['pinned-old']);
    expect(grouped.today.map((item) => item.id)).toEqual(['today']);
    expect(grouped.earlier_this_week.map((item) => item.id)).toEqual(['week']);
    expect(grouped.older.map((item) => item.id)).toEqual(['old']);
  });

  it('sorts every bucket by newest notification first', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 22, 12));

    const grouped = groupNotifications(
      [
        notification('today-old', '2026-07-22T09:00:00.000Z'),
        notification('today-new', '2026-07-22T11:00:00.000Z'),
        notification('pinned-old', '2026-07-10T09:00:00.000Z'),
        notification('pinned-new', '2026-07-20T09:00:00.000Z'),
      ],
      new Set(['pinned-old', 'pinned-new']),
    );

    sortGroupedNotifications(grouped);

    expect(grouped.pinned.map((item) => item.id)).toEqual([
      'pinned-new',
      'pinned-old',
    ]);
    expect(grouped.today.map((item) => item.id)).toEqual([
      'today-new',
      'today-old',
    ]);
  });

  it('returns display labels for every date group', () => {
    expect(getDateGroupLabel('today')).toBe('Today');
    expect(getDateGroupLabel('earlier_this_week')).toBe('Earlier this week');
    expect(getDateGroupLabel('older')).toBe('Older');
  });
});
