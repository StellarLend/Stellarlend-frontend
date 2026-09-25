import { describe, it, expect, vi, beforeEach } from "vitest";

const insertValues = vi.fn();
const onConflictDoNothing = vi.fn();
const returning = vi.fn();
const updateSet = vi.fn();
const updateWhere = vi.fn();
const selectOrderBy = vi.fn();

vi.mock("@/lib/db", () => ({
  db: {
    insert: vi.fn(() => ({
      values: (...args: unknown[]) => {
        insertValues(...args);
        return {
          onConflictDoNothing: (...args: unknown[]) => {
            onConflictDoNothing(...args);
            return { returning };
          },
        };
      },
    })),
    update: vi.fn(() => ({
      set: (...args: unknown[]) => {
        updateSet(...args);
        return { where: (...whereArgs: unknown[]) => updateWhere(...whereArgs) };
      },
    })),
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({ orderBy: selectOrderBy })),
      })),
    })),
  },
}));

vi.mock("@/lib/streams/notification-hub", () => ({
  notificationHub: { publish: vi.fn() },
}));

vi.mock("@/lib/queue", () => ({
  enqueue: vi.fn(),
}));

import { addNotification, addNotificationWithOutcome } from "@/lib/notifications/repository";

const NEW_NOTIFICATION = {
  id: "notif-1",
  title: "Liquidation warning",
  message: "Your position approaches the threshold.",
  type: "warning" as const,
  read: false,
  createdAt: "2026-01-01T00:00:00.000Z",
};

describe("notifications repository delivery invariants", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    selectOrderBy.mockResolvedValue([]);
    updateWhere.mockResolvedValue(undefined);
  });

  it("reports inserted=true and issues no update on first delivery", async () => {
    returning.mockResolvedValue([{ id: "user-1-notif-1" }]);

    const outcome = await addNotificationWithOutcome("user-1", NEW_NOTIFICATION);

    expect(outcome.inserted).toBe(true);
    expect(outcome.notification.userId).toBe("user-1");
    expect(updateSet).not.toHaveBeenCalled();
  });

  it("reports inserted=false when the notification id already exists", async () => {
    returning.mockResolvedValue([]);

    const outcome = await addNotificationWithOutcome("user-1", NEW_NOTIFICATION);

    expect(outcome.inserted).toBe(false);
  });

  it("refreshes presentation fields on redelivery but never rewrites read or createdAt", async () => {
    returning.mockResolvedValue([]);

    await addNotificationWithOutcome("user-1", NEW_NOTIFICATION);

    expect(updateSet).toHaveBeenCalledTimes(1);
    const updated = updateSet.mock.calls[0][0] as Record<string, unknown>;

    expect(Object.keys(updated).sort()).toEqual(["message", "title", "type"]);
    expect(updated).not.toHaveProperty("read");
    expect(updated).not.toHaveProperty("createdAt");
  });

  it("cannot resurrect a read notification through redelivery", async () => {
    returning.mockResolvedValue([]);

    // The producer reports read:false, but the row already exists and was
    // marked read by the user. The read state must survive untouched.
    await addNotificationWithOutcome("user-1", { ...NEW_NOTIFICATION, read: false });

    const updated = updateSet.mock.calls[0][0] as Record<string, unknown>;
    expect(updated).not.toHaveProperty("read");
  });

  it("scopes the row key to the owning user", async () => {
    returning.mockResolvedValue([{ id: "user-2-notif-1" }]);

    await addNotificationWithOutcome("user-2", NEW_NOTIFICATION);

    const [record] = insertValues.mock.calls[0] as [Record<string, unknown>];
    expect(record.id).toBe("user-2-notif-1");
    expect(record.userId).toBe("user-2");
  });

  it("rejects an empty userId before touching the database", async () => {
    await expect(addNotificationWithOutcome("", NEW_NOTIFICATION)).rejects.toThrow(
      /Invalid userId/,
    );
    expect(insertValues).not.toHaveBeenCalled();
  });

  it("rejects an empty notification id before touching the database", async () => {
    await expect(
      addNotificationWithOutcome("user-1", { ...NEW_NOTIFICATION, id: "" }),
    ).rejects.toThrow(/Invalid notification id/);
    expect(insertValues).not.toHaveBeenCalled();
  });

  it("keeps addNotification returning the notification for existing callers", async () => {
    returning.mockResolvedValue([{ id: "user-1-notif-1" }]);

    const notification = await addNotification("user-1", NEW_NOTIFICATION);

    expect(notification.userId).toBe("user-1");
    expect(notification.id).toBe("notif-1");
  });
});
