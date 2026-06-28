import type { Notification } from './types';

export type DateGroup = 'today' | 'earlier_this_week' | 'older';

function getStartOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getStartOfWeek(date: Date): Date {
  const d = getStartOfDay(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

export function getDateGroup(date: Date): DateGroup {
  const now = new Date();
  const startOfToday = getStartOfDay(now);
  const startOfWeek = getStartOfWeek(now);

  if (date >= startOfToday) return 'today';
  if (date >= startOfWeek) return 'earlier_this_week';
  return 'older';
}

export function getDateGroupLabel(group: DateGroup): string {
  switch (group) {
    case 'today':
      return 'Today';
    case 'earlier_this_week':
      return 'Earlier this week';
    case 'older':
      return 'Older';
  }
}

export interface GroupedNotifications {
  pinned: Notification[];
  today: Notification[];
  earlier_this_week: Notification[];
  older: Notification[];
}

export function groupNotifications(
  notifications: Notification[],
  pinnedIds: Set<string>,
): GroupedNotifications {
  const grouped: GroupedNotifications = {
    pinned: [],
    today: [],
    earlier_this_week: [],
    older: [],
  };

  for (const n of notifications) {
    if (pinnedIds.has(n.id)) {
      grouped.pinned.push(n);
    } else {
      const group = getDateGroup(new Date(n.createdAt));
      grouped[group].push(n);
    }
  }

  return grouped;
}

export function sortGroupedNotifications(grouped: GroupedNotifications): void {
  const sortDesc = (a: Notification, b: Notification) =>
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();

  grouped.pinned.sort(sortDesc);
  grouped.today.sort(sortDesc);
  grouped.earlier_this_week.sort(sortDesc);
  grouped.older.sort(sortDesc);
}
