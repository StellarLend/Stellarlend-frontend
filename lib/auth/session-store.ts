export type StoredSession = {
  id: string;
  userId: string;
  walletAddress?: string;
  userAgent: string;
  ipAddress: string;
  createdAt: string;
  lastSeenAt: string;
};

const sessions = new Map<string, StoredSession>();

export function createStoredSession(input: Omit<StoredSession, "createdAt" | "lastSeenAt">) {
  const now = new Date().toISOString();

  const session: StoredSession = {
    ...input,
    createdAt: now,
    lastSeenAt: now,
  };

  sessions.set(session.id, session);
  return session;
}

export function listStoredSessions(userId: string) {
  return Array.from(sessions.values()).filter((session) => session.userId === userId);
}

export function getStoredSession(id: string) {
  return sessions.get(id) ?? null;
}

export function touchStoredSession(id: string) {
  const session = sessions.get(id);

  if (!session) return null;

  const updated = {
    ...session,
    lastSeenAt: new Date().toISOString(),
  };

  sessions.set(id, updated);
  return updated;
}

export function revokeStoredSession(id: string) {
  return sessions.delete(id);
}