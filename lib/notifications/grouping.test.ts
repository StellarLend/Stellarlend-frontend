import { describe, it, expect, vi, afterEach } from 'vitest';
import type { Notification } from './types';
import {
  getDateGroup,
  getDateGroupLabel,
  groupNotifications,
  sortGroupedNotifications,
  type DateGroup,
  type GroupedNotifications,
} from './grouping';

function makeNotification(overrides: Partial<Notification> & { createdAt: string }): Notification {
  return {
    id: overrides.id ?? `n-${Math.random().toString(36).slice(2, 8)}`,
    userId: overrides.userId ?? 'user-1',
    title: overrides.title ?? 'Test',
    message: overrides.message ?? 'Test message',
    read: overrides.read ?? false,
    pinned: overrides.pinned,
    createdAt: overrides.createdAt,
    type: overrides.type ?? 'info',
  };
}

function daysAgo(n: number, date: Date = new Date()): Date {
  const d = new Date(date);
  d.setDate(d.getDate() - n);
  return d;
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function getStartOfWeek(now: Date): Date {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

afterEach(() => {
  vi.useRealTimers();
});

describe('getDateGroup', () => {
  it('classifies a timestamp at exactly midnight (start of today) as today', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-07-15T12:00:00Z'));

    const startOfDay = new Date('2025-07-15T00:00:00Z');
    expect(getDateGroup(startOfDay)).toBe('today');
  });

  it('classifies a timestamp one millisecond before midnight as older (not today)', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-07-15T00:00:00Z'));

    const justBeforeMidnight = new Date('2025-07-14T23:59:59.999Z');
    // It's before startOfToday but should still be within the week
    const group = getDateGroup(justBeforeMidnight);
    expect(group).not.toBe('today');
    expect(group).toBe('earlier_this_week');
  });

  it('classifies a notification from earlier this week as earlier_this_week', () => {
    vi.useFakeTimers();
    // Wednesday 2025-07-16 12:00 UTC — start of week is Monday 2025-07-14
    vi.setSystemTime(new Date('2025-07-16T12:00:00Z'));

    // Tuesday is within the week
    const tuesday = new Date('2025-07-15T10:00:00Z');
    expect(getDateGroup(tuesday)).toBe('earlier_this_week');
  });

  it('classifies a notification from before the week boundary as older', () => {
    vi.useFakeTimers();
    // Monday 2025-07-14 00:00 UTC — start of week is Monday 2025-07-14
    vi.setSystemTime(new Date('2025-07-14T00:00:00Z'));

    // Sunday before is the previous week
    const sunday = new Date('2025-07-13T23:59:59Z');
    expect(getDateGroup(sunday)).toBe('older');
  });

  it('handles Sunday correctly — Sunday is not part of the current Mon–Sun week start', () => {
    vi.useFakeTimers();
    // Saturday 2025-07-19 12:00 UTC — start of week is Monday 2025-07-14
    vi.setSystemTime(new Date('2025-07-19T12:00:00Z'));

    // Previous Sunday 2025-07-13 is before the Monday start, so "older"
    const prevSunday = new Date('2025-07-13T12:00:00Z');
    expect(getDateGroup(prevSunday)).toBe('older');
  });

  it('classifies "now" as today', () => {
    vi.useFakeTimers();
    const now = new Date('2025-09-01T15:30:00Z');
    vi.setSystemTime(now);

    expect(getDateGroup(new Date(now))).toBe('today');
  });

  it('classifies a date far in the past as older', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-07-15T12:00:00Z'));

    const ancient = new Date('2020-01-01T00:00:00Z');
    expect(getDateGroup(ancient)).toBe('older');
  });

  it('boundary: date exactly at startOfWeek is earlier_this_week, one ms before is older', () => {
    vi.useFakeTimers();
    // Wednesday 2025-07-16 → week starts Monday 2025-07-14
    vi.setSystemTime(new Date('2025-07-16T12:00:00Z'));

    const startOfWeek = getStartOfWeek(new Date('2025-07-16T12:00:00Z'));
    expect(startOfWeek.toISOString()).toBe('2025-07-14T00:00:00.000Z');

    expect(getDateGroup(startOfWeek)).toBe('earlier_this_week');

    const oneMsBefore = new Date(startOfWeek.getTime() - 1);
    expect(getDateGroup(oneMsBefore)).toBe('older');
  });
});

describe('getDateGroupLabel', () => {
  it('returns correct labels for all groups', () => {
    expect(getDateGroupLabel('today')).toBe('Today');
    expect(getDateGroupLabel('earlier_this_week')).toBe('Earlier this week');
    expect(getDateGroupLabel('older')).toBe('Older');
  });
});

describe('groupNotifications', () => {
  it('places pinned notifications in the pinned group regardless of their date', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-07-15T12:00:00Z'));

    const oldNotification = makeNotification({
      id: 'old-pinned',
      createdAt: '2020-01-01T00:00:00Z',
      pinned: true,
    });
    const todayNotification = makeNotification({
      id: 'today-unpinned',
      createdAt: '2025-07-15T10:00:00Z',
    });

    const pinnedIds = new Set(['old-pinned']);
    const grouped = groupNotifications([oldNotification, todayNotification], pinnedIds);

    expect(grouped.pinned).toHaveLength(1);
    expect(grouped.pinned[0].id).toBe('old-pinned');
    expect(grouped.today).toHaveLength(1);
    expect(grouped.today[0].id).toBe('today-unpinned');
    expect(grouped.older).toHaveLength(0);
  });

  it('places unpinned notifications into the correct date bucket', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-07-16T12:00:00Z'));
    // Week starts Monday 2025-07-14

    const today = makeNotification({ id: 't', createdAt: '2025-07-16T08:00:00Z' });
    const thisWeek = makeNotification({ id: 'w', createdAt: '2025-07-15T08:00:00Z' });
    const older = makeNotification({ id: 'o', createdAt: '2025-07-12T08:00:00Z' });

    const grouped = groupNotifications([today, thisWeek, older], new Set());

    expect(grouped.pinned).toHaveLength(0);
    expect(grouped.today).toHaveLength(1);
    expect(grouped.today[0].id).toBe('t');
    expect(grouped.earlier_this_week).toHaveLength(1);
    expect(grouped.earlier_this_week[0].id).toBe('w');
    expect(grouped.older).toHaveLength(1);
    expect(grouped.older[0].id).toBe('o');
  });

  it('returns empty groups when given an empty array', () => {
    const grouped = groupNotifications([], new Set());
    expect(grouped.pinned).toHaveLength(0);
    expect(grouped.today).toHaveLength(0);
    expect(grouped.earlier_this_week).toHaveLength(0);
    expect(grouped.older).toHaveLength(0);
  });

  it('handles an empty pinnedIds set', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-07-15T12:00:00Z'));

    const n = makeNotification({ createdAt: '2025-07-15T10:00:00Z' });
    const grouped = groupNotifications([n], new Set());
    expect(grouped.pinned).toHaveLength(0);
    expect(grouped.today).toHaveLength(1);
  });
});

describe('sortGroupedNotifications', () => {
  it('sorts each group in descending order by createdAt', () => {
    const grouped: GroupedNotifications = {
      pinned: [
        makeNotification({ id: 'p1', createdAt: '2025-07-10T00:00:00Z' }),
        makeNotification({ id: 'p2', createdAt: '2025-07-15T00:00:00Z' }),
        makeNotification({ id: 'p3', createdAt: '2025-07-12T00:00:00Z' }),
      ],
      today: [
        makeNotification({ id: 't1', createdAt: '2025-07-15T06:00:00Z' }),
        makeNotification({ id: 't2', createdAt: '2025-07-15T12:00:00Z' }),
      ],
      earlier_this_week: [
        makeNotification({ id: 'w1', createdAt: '2025-07-14T08:00:00Z' }),
        makeNotification({ id: 'w2', createdAt: '2025-07-15T02:00:00Z' }),
      ],
      older: [
        makeNotification({ id: 'o1', createdAt: '2025-07-01T00:00:00Z' }),
        makeNotification({ id: 'o2', createdAt: '2025-06-01T00:00:00Z' }),
      ],
    };

    sortGroupedNotifications(grouped);

    expect(grouped.pinned.map((n) => n.id)).toEqual(['p2', 'p3', 'p1']);
    expect(grouped.today.map((n) => n.id)).toEqual(['t2', 't1']);
    expect(grouped.earlier_this_week.map((n) => n.id)).toEqual(['w2', 'w1']);
    expect(grouped.older.map((n) => n.id)).toEqual(['o1', 'o2']);
  });

  it('mutates the object in place and returns nothing', () => {
    const grouped: GroupedNotifications = {
      pinned: [
        makeNotification({ id: 'a', createdAt: '2025-01-01T00:00:00Z' }),
        makeNotification({ id: 'b', createdAt: '2025-06-01T00:00:00Z' }),
      ],
      today: [],
      earlier_this_week: [],
      older: [],
    };

    const result = sortGroupedNotifications(grouped);
    expect(result).toBeUndefined();
    expect(grouped.pinned[0].id).toBe('b');
    expect(grouped.pinned[1].id).toBe('a');
  });

  it('handles empty groups without error', () => {
    const grouped: GroupedNotifications = {
      pinned: [],
      today: [],
      earlier_this_week: [],
      older: [],
    };

    expect(() => sortGroupedNotifications(grouped)).not.toThrow();
  });
});
