import { NextResponse } from 'next/server';
import { getUser } from '@/lib/auth';
import { markAllNotificationsRead } from '@/lib/notifications/repository';
import { withCsrfProtection } from '@/lib/api/handler';

export const runtime = 'nodejs';

/** PATCH /api/notifications/read-all
 *
 *  Marks all unread notifications as read for the authenticated user.
 *  Requires an authenticated session (session cookie).
 *
 *  Response shape:
 *    { updatedCount: number }
 *
 *  Errors:
 *    401  – no valid session
 */
const patchHandler = async () => {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const updatedCount = await markAllNotificationsRead(user.id);

  return NextResponse.json({ updatedCount });
};

export const PATCH = withCsrfProtection(patchHandler);
