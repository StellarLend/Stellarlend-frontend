import { NextResponse } from 'next/server';
import { getUser } from '@/lib/auth';
import { getNotifications, setNotificationsReadState } from '@/lib/notifications/repository';

export const runtime = 'nodejs';

/** GET /api/notifications
 *
 *  Requires an authenticated session (session cookie).
 *  Returns the caller's notifications list and unread count.
 *
 *  Response shape:
 *    { notifications: Notification[], unreadCount: number }
 *
 *  Errors:
 *    401  – no valid session
 */
export async function GET() {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const notifications = await getNotifications(user.id);
  const unreadCount = notifications.filter((n) => !n.read).length;

  const response = NextResponse.json({ notifications, unreadCount });
  response.headers.set('Cache-Control', 'no-store');
  return response;
}

/** PATCH /api/notifications
 *
 *  Body: { notificationIds: string[], read: boolean }
 *
 *  Idempotently updates the read state of the caller's notifications.
 */
export async function PATCH(request: Request) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { notificationIds, read } = body ?? {};

  if (!Array.isArray(notificationIds) || notificationIds.some((id) => typeof id !== 'string')) {
    return NextResponse.json({ error: 'notificationIds must be an array of strings' }, { status: 400 });
  }
  if (typeof read !== 'boolean') {
    return NextResponse.json({ error: 'read must be a boolean' }, { status: 400 });
  }

  const updatedCount = await setNotificationsReadState({ userId: user.id, notificationIds, read });
  return NextResponse.json({ updatedCount });
}
