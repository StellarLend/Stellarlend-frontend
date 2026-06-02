import { randomBytes } from 'crypto';

export interface DeletionChallenge {
  challenge: string;
  userId: string;
  expiresAt: Date;
  createdAt: Date;
}

const challengeStore = new Map<string, DeletionChallenge>();
const CHALLENGE_TTL_MS = 5 * 60 * 1000;

export function createDeletionChallenge(userId: string): DeletionChallenge {
  const challenge = randomBytes(32).toString('hex');
  const now = new Date();

  const record: DeletionChallenge = {
    challenge,
    userId,
    expiresAt: new Date(now.getTime() + CHALLENGE_TTL_MS),
    createdAt: now,
  };

  challengeStore.set(challenge, record);
  return record;
}

export function verifyDeletionChallenge(
  challenge: string,
  userId: string
): boolean {
  const record = challengeStore.get(challenge);
  if (!record) return false;

  if (record.userId !== userId) return false;
  if (new Date() > record.expiresAt) {
    challengeStore.delete(challenge);
    return false;
  }

  challengeStore.delete(challenge);
  return true;
}

export function clearChallengeStore(): void {
  challengeStore.clear();
}

export function getChallengeCount(): number {
  return challengeStore.size;
}
