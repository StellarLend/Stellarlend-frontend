export type NotificationType = 'info' | 'success' | 'warning' | 'error';

/**
 * The canonical list of valid notification types, kept in sync with the
 * `notification_type` Postgres enum in lib/db/schema/notifications.ts.
 *
 * Declared as a runtime array (rather than only a type) so the guard below can
 * validate raw database values without duplicating the union by hand.
 */
export const NOTIFICATION_TYPES = [
  'info',
  'success',
  'warning',
  'error',
] as const;

const NOTIFICATION_TYPE_SET: ReadonlySet<string> = new Set(NOTIFICATION_TYPES);

/**
 * Narrows an arbitrary (e.g. raw database) value to a valid `NotificationType`.
 *
 * Rows persisted before the type column was constrained — or a typo introduced
 * by a future migration — could surface a value outside the known union. Rather
 * than letting that bogus value flow through as a `NotificationType` and hit
 * `typeColors[n.type]` as `undefined`, unknown values fall back to `'info'`.
 */
export function parseNotificationType(value: unknown): NotificationType {
  return typeof value === 'string' && NOTIFICATION_TYPE_SET.has(value)
    ? (value as NotificationType)
    : 'info';
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  read: boolean;
  pinned?: boolean;
  createdAt: string;
  type: NotificationType;
}

export interface NotificationsResponse {
  notifications: Notification[];
  unreadCount: number;
}
