import { describe, it, expect } from 'vitest';
import { notificationHub } from './notification-hub';

describe('notificationHub', () => {
  it('delivers events to subscribers and supports unsubscribe', () => {
    const userId = 'u1';
    const received: any[] = [];

    const unsub = notificationHub.subscribe(userId, (evt) => {
      received.push(evt);
    });

    notificationHub.publish(userId, { type: 'notification', notification: { id: 'n1' } });
    notificationHub.publish(userId, { type: 'unreadCount', unreadCount: 3 });

    expect(received).toHaveLength(2);
    expect(received[0]).toHaveProperty('type', 'notification');
    expect(received[1]).toHaveProperty('type', 'unreadCount');

    unsub();

    notificationHub.publish(userId, { type: 'unreadCount', unreadCount: 4 });
    expect(received).toHaveLength(2);
  });
});
