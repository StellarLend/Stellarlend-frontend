import { NextResponse } from 'next/server';
import { getUser } from '@/lib/auth';
import { getNotifications } from '@/lib/notifications/repository';

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

  return NextResponse.json({ notifications, unreadCount });
}
