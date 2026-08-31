import { NextResponse } from 'next/server';
import { getUser } from '@/lib/auth';
import { getNotifications } from '@/lib/notifications/repository';

export const runtime = 'nodejs';

/** GET /api/notifications - returns notifications and unread count. */
export async function GET() {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const notifications = await getNotifications(user.id);
    const unreadCount = notifications.filter((n) => !n.read).length;
    return NextResponse.json({ notifications, unreadCount });
  } catch (error) {
    console.error('Failed to fetch notifications:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
