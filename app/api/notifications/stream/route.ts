import { NextResponse } from 'next/server';
import { getUser } from '@/lib/auth';
import { notificationHub } from '@/lib/streams/notification-hub';

export const runtime = 'nodejs';

function formatSSE(event: string, data: any) {
  const json = typeof data === 'string' ? data : JSON.stringify(data);
  return `event: ${event}\ndata: ${json}\n\n`;
}

/** GET /api/notifications/stream
 *
 * Server-Sent Events endpoint that pushes per-user notification events.
 * Requires session cookie authentication via getUser().
 */
export async function GET() {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const stream = new ReadableStream({
    start(controller) {
      // Send a comment and retry hint to help clients
      controller.enqueue(new TextEncoder().encode('retry: 5000\n\n'));

      const unsubscribe = notificationHub.subscribe(user.id, (evt) => {
        if (evt.type === 'notification') {
          controller.enqueue(new TextEncoder().encode(formatSSE('notification', evt.notification)));
        } else if (evt.type === 'unreadCount') {
          controller.enqueue(new TextEncoder().encode(formatSSE('unreadCount', { unreadCount: evt.unreadCount })));
        }
      });

      // When the consumer closes, unsubscribe
      (controller as any).unsubscribe = unsubscribe;
    },
    cancel() {
      // cancel is called when the downstream terminates
      try {
        const anyController = this as any;
        if (typeof anyController.unsubscribe === 'function') anyController.unsubscribe();
      } catch (e) {
        // noop
      }
    },
  });

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
