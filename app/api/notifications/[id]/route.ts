import { NextRequest, NextResponse } from 'next/server';
import { getUser } from '@/lib/auth';
import { markNotificationRead } from '@/lib/notifications/repository';
import { withCsrfProtection } from '@/lib/api/handler';

export const runtime = 'nodejs';

/** PATCH /api/notifications/:id
 *
 *  Marks a notification as read for the authenticated user.
 *  Requires an authenticated session (session cookie).
 *
 *  Route params:
 *    id  – notification ID (string)
 *
 *  Response shape:
 *    { notification: Notification }
 *
 *  Errors:
 *    400  – missing or blank id
 *    401  – no valid session
 *    404  – notification not found for this user
 */
const patchHandler = async (
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) => {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  if (!id || typeof id !== 'string' || id.trim() === '') {
    return NextResponse.json({ error: 'Invalid notification id' }, { status: 400 });
  }

  const notification = markNotificationRead(user.id, id.trim());
  if (!notification) {
    return NextResponse.json({ error: 'Notification not found' }, { status: 404 });
  }

  return NextResponse.json({ notification });
};

export const PATCH = withCsrfProtection(patchHandler);
