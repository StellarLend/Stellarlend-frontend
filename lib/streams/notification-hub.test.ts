import { describe, it, expect } from 'vitest';
import { notificationHub } from './notification-hub';

describe('notificationHub', () => {
  afterEach(() => {
    notificationHub.publish('cleanup-test', { type: 'notification', notification: null });
  });

  it('delivers events to a single subscriber and supports unsubscribe', () => {
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

  it('delivers events to multiple subscribers for the same user', () => {
    const userId = 'multi';
    const receivedA: any[] = [];
    const receivedB: any[] = [];

    const unsubA = notificationHub.subscribe(userId, (evt) => {
      receivedA.push(evt);
    });
    const unsubB = notificationHub.subscribe(userId, (evt) => {
      receivedB.push(evt);
    });

    notificationHub.publish(userId, { type: 'notification', notification: { id: 'n1' } });

    expect(receivedA).toHaveLength(1);
    expect(receivedB).toHaveLength(1);
    expect(receivedA[0]).toEqual({ type: 'notification', notification: { id: 'n1' } });
    expect(receivedB[0]).toEqual(receivedA[0]);

    unsubA();
    unsubB();
  });

  it('isolates events between different users', () => {
    const receivedA: any[] = [];
    const receivedB: any[] = [];

    const unsubA = notificationHub.subscribe('user-a', (evt) => {
      receivedA.push(evt);
    });
    const unsubB = notificationHub.subscribe('user-b', (evt) => {
      receivedB.push(evt);
    });

    notificationHub.publish('user-a', { type: 'notification', notification: { id: 'a1' } });

    expect(receivedA).toHaveLength(1);
    expect(receivedB).toHaveLength(0);

    notificationHub.publish('user-b', { type: 'unreadCount', unreadCount: 5 });

    expect(receivedA).toHaveLength(1);
    expect(receivedB).toHaveLength(1);
    expect(receivedB[0]).toEqual({ type: 'unreadCount', unreadCount: 5 });

    unsubA();
    unsubB();
  });

  it('does not deliver events after unsubscribe', () => {
    const userId = 'unsub-test';
    const received: any[] = [];

    const unsub = notificationHub.subscribe(userId, (evt) => {
      received.push(evt);
    });

    notificationHub.publish(userId, { type: 'notification', notification: { id: 'pre' } });
    expect(received).toHaveLength(1);

    unsub();

    notificationHub.publish(userId, { type: 'unreadCount', unreadCount: 10 });
    notificationHub.publish(userId, { type: 'notification', notification: { id: 'post' } });
    expect(received).toHaveLength(1);
  });

  it('handles double-unsubscribe gracefully', () => {
    const userId = 'double-unsub';
    const received: any[] = [];

    const unsub = notificationHub.subscribe(userId, (evt) => {
      received.push(evt);
    });

    unsub();
    unsub();

    notificationHub.publish(userId, { type: 'notification', notification: { id: 'after' } });
    expect(received).toHaveLength(0);
  });

  it('publishes with no subscribers does not error', () => {
    expect(() => {
      notificationHub.publish('ghost', { type: 'notification', notification: { id: 'no-one' } });
      notificationHub.publish('ghost', { type: 'unreadCount', unreadCount: 0 });
    }).not.toThrow();
  });

  it('resets listener count to zero after unsubscribe', () => {
    const userId = 'leak-check';

    expect(notificationHub.listenerCount(userId)).toBe(0);

    const unsub = notificationHub.subscribe(userId, () => {});

    expect(notificationHub.listenerCount(userId)).toBe(1);

    unsub();

    expect(notificationHub.listenerCount(userId)).toBe(0);
  });

  it('delivers unreadCount event with correct shape', () => {
    const userId = 'shape-test';
    const received: any[] = [];

    const unsub = notificationHub.subscribe(userId, (evt) => {
      received.push(evt);
    });

    notificationHub.publish(userId, { type: 'unreadCount', unreadCount: 7 });

    expect(received).toHaveLength(1);
    expect(received[0]).toEqual({ type: 'unreadCount', unreadCount: 7 });

    unsub();
  });

  it('delivers notification event with correct shape', () => {
    const userId = 'notif-shape';
    const received: any[] = [];

    const unsub = notificationHub.subscribe(userId, (evt) => {
      received.push(evt);
    });

    const notif = { id: 'n-42', title: 'New update', body: 'Your loan was approved.' };
    notificationHub.publish(userId, { type: 'notification', notification: notif });

    expect(received).toHaveLength(1);
    expect(received[0]).toEqual({ type: 'notification', notification: notif });

    unsub();
  });
});
