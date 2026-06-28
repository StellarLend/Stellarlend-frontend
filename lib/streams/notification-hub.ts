import EventEmitter from 'events';

export type NotificationEvent =
  | { type: 'notification'; notification: unknown }
  | { type: 'unreadCount'; unreadCount: number };

class NotificationHub {
  private emitter = new EventEmitter();

  // Subscribe to events for a particular userId. Returns an unsubscribe fn.
  subscribe(userId: string, cb: (evt: NotificationEvent) => void) {
    const key = this.keyFor(userId);
    this.emitter.on(key, cb);
    return () => this.emitter.off(key, cb);
  }

  publish(userId: string, evt: NotificationEvent) {
    const key = this.keyFor(userId);
    this.emitter.emit(key, evt);
  }

  listenerCount(userId: string): number {
    return this.emitter.listenerCount(this.keyFor(userId));
  }

  private keyFor(userId: string) {
    return `notifications:${userId}`;
  }
}

export const notificationHub = new NotificationHub();

export default notificationHub;
