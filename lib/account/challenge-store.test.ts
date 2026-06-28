// lib/account/challenge-store.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  createDeletionChallenge,
  verifyDeletionChallenge,
  clearChallengeStore,
  getChallengeCount,
} from './challenge-store';

const CHALLENGE_TTL_MS = 5 * 60 * 1000; // same as implementation

describe('DeletionChallenge store', () => {
  beforeEach(() => {
    clearChallengeStore();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('valid challenge verifies for correct user', () => {
    const userId = 'user-123';
    const { challenge } = createDeletionChallenge(userId);
    const ok = verifyDeletionChallenge(challenge, userId);
    expect(ok).toBe(true);
    expect(getChallengeCount()).toBe(0);
  });

  it('challenge expires after TTL', () => {
    const userId = 'user-456';
    const { challenge } = createDeletionChallenge(userId);
    vi.advanceTimersByTime(CHALLENGE_TTL_MS + 1000);
    const ok = verifyDeletionChallenge(challenge, userId);
    expect(ok).toBe(false);
    expect(getChallengeCount()).toBe(0);
  });

  it('challenge is single‑use', () => {
    const userId = 'user-789';
    const { challenge } = createDeletionChallenge(userId);
    const first = verifyDeletionChallenge(challenge, userId);
    const second = verifyDeletionChallenge(challenge, userId);
    expect(first).toBe(true);
    expect(second).toBe(false);
    expect(getChallengeCount()).toBe(0);
  });

  it('unknown challenge string fails', () => {
    const result = verifyDeletionChallenge('nonexistent', 'anyUser');
    expect(result).toBe(false);
  });

  it('mismatched userId fails verification', () => {
    const { challenge } = createDeletionChallenge('correctUser');
    const result = verifyDeletionChallenge(challenge, 'wrongUser');
    expect(result).toBe(false);
    // After mismatched attempt, challenge should still be present and usable with correct user.
    const second = verifyDeletionChallenge(challenge, 'correctUser');
    expect(second).toBe(true);
  });
});
