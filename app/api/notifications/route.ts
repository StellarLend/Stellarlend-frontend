import { NextRequest, NextResponse } from 'next/server';
import { getUser } from '@/lib/auth';
import { getNotifications, getUnreadCount } from '@/lib/notifications/repository';
import { parseNotificationsPagination } from '@/lib/validation/notifications';

export const runtime = 'nodejs';

/** GET /api/notifications?limit=&offset=
 *
 *  Requires an authenticated session (session cookie).
 *  Returns a bounded page of the caller's notifications plus the total
 *  unread count (computed independently of the page so it stays accurate
 *  even when the unread items fall outside the current page).
 *
 *  `limit` defaults to 50 and is clamped to a maximum of 100.
 *  `offset` defaults to 0. Invalid values fall back to the defaults rather
 *  than erroring, since these only affect a read-only listing.
 *
 *  Response shape:
 *    { notifications: Notification[], unreadCount: number, hasMore: boolean }
 *
 *  Errors:
 *    401  – no valid session
 */
export async function GET(request: NextRequest) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const { limit, offset } = parseNotificationsPagination({
    limit: searchParams.get('limit'),
    offset: searchParams.get('offset'),
  });

  const [{ notifications, hasMore }, unreadCount] = await Promise.all([
    getNotifications(user.id, { limit, offset }),
    getUnreadCount(user.id),
  ]);

  return NextResponse.json({ notifications, unreadCount, hasMore });
}
