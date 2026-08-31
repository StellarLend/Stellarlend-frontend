import { NextResponse } from 'next/server';
import { getUser } from '@/lib/auth';
import { notificationHub } from '@/lib/streams/notification-hub';
import { withControllerCleanup } from '@/lib/streams/with-controller-cleanup';

export const runtime = 'nodejs';

function formatSSE(event: string, data: any) {
  const json = typeof data === 'string' ? data : JSON.stringify(data);
  return `event: ${event}\ndata: ${json}\n\n`;
}

/** GET /api/notifications/stream
 *
 * Server-Sent Events endpoint that pushes per-user notification events.
 *
 * Contract:
 * - Requires session cookie authentication via getUser(); returns 401 otherwise.
 * - Streams events of type 'notification' and 'unreadCount'.
 * - Clients MUST reconnect on error; server sends 'retry: 5000' hint.
 * - Server sends a heartbeat comment every 30s to keep intermediaries from closing the connection.
 * - The stream is closed automatically on client disconnect; subscription is cleaned up.
 *
 * Invariants:
 * - Only the authenticated user's events are delivered (notificationHub scopes by user.id).
 * - Events are pushed as they occur; no replay on this stream.
 * - Unauthorized access is rejected with 401.
 */
export async function GET() {
  const user = await getUser();
  if (!user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const stream = new ReadableStream(
    withControllerCleanup((controller, onCleanup) => {
      // Send retry hint to help clients reconnect after errors
      controller.enqueue(new TextEncoder().encode('retry: 5000\n\n'));

      // Heartbeat to keep the connection alive through proxies
      const heartbeat = setInterval(() => {
        controller.enqueue(new TextEncoder().encode(': heartbeat\n\n'));
      }, 30000);

      const unsubscribe = notificationHub.subscribe(user.id, (evt) => {
        if (evt.type === 'notification') {
          controller.enqueue(new TextEncoder().encode(formatSSE('notification', evt.notification)));
        } else if (evt.type === 'unreadCount') {
          controller.enqueue(new TextEncoder().encode(formatSSE('unreadCount', { unreadCount: evt.unreadCount })));
        }
      });

      // Cleanup on stream close/cancel/error
      onCleanup(() => {
        clearInterval(heartbeat);
        unsubscribe();
      });
    }),
  );

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
