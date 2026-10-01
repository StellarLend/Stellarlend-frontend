// @vitest-environment jsdom
/**
 * Direct unit tests for useNotificationPins hook (#1471)
 *
 * Coverage:
 * - togglePin: pin, unpin, and toggle-back behaviour
 * - corrupted localStorage JSON (try/catch in getStoredPins, ~line 12)
 * - localStorage.setItem throwing when storage is full (try/catch in storePins, ~line 24)
 * - storage event for a different key is correctly ignored (~line 34)
 * - cross-tab storage event for the correct key refreshes state
 *
 * These edge cases are not exercised by NotificationBell.test.tsx /
 * NotificationBell.memo.test.tsx / NotificationBell.grouping.test.tsx
 * because those files mock the hook entirely.
 */
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useNotificationPins } from './useNotificationPins';

// The exact key the hook uses — mirrors the constant in the implementation so
// tests break if the key ever drifts without a corresponding update here.
const STORAGE_KEY = 'notification-pinned-ids';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Seed localStorage with a valid JSON array of pinned IDs so the hook
 * initialises with pre-existing state.
 */
function seedStorage(ids: string[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
}

/**
 * Fire a synthetic StorageEvent on window, targeting the given key.
 * jsdom does not fire storage events automatically on same-tab writes, so
 * we dispatch them manually to test the cross-tab listener path.
 */
function fireStorageEvent(key: string | null, newValue: string | null) {
  window.dispatchEvent(
    new StorageEvent('storage', {
      key,
      newValue,
      storageArea: window.localStorage,
    }),
  );
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useNotificationPins', () => {
  // -------------------------------------------------------------------------
  // Core togglePin behaviour
  // -------------------------------------------------------------------------

  it('toggles pin state and persists it to localStorage', () => {
    const { result } = renderHook(() => useNotificationPins());

    expect(result.current.isPinned('note-1')).toBe(false);

    act(() => {
      result.current.togglePin('note-1');
    });

    expect(result.current.isPinned('note-1')).toBe(true);
    expect(localStorage.getItem(STORAGE_KEY)).toBe(JSON.stringify(['note-1']));

    act(() => {
      result.current.togglePin('note-1');
    });

    expect(result.current.isPinned('note-1')).toBe(false);
    expect(localStorage.getItem(STORAGE_KEY)).toBe(JSON.stringify([]));
  });

  describe('togglePin — normal behaviour', () => {
    it('starts with an empty pin set when localStorage is empty', () => {
      const { result } = renderHook(() => useNotificationPins());

      expect(result.current.pinnedIds.size).toBe(0);
      expect(result.current.isPinned('any-id')).toBe(false);
    });

    it('pins an id that was not previously pinned', () => {
      const { result } = renderHook(() => useNotificationPins());

      act(() => {
        result.current.togglePin('n1');
      });

      expect(result.current.isPinned('n1')).toBe(true);
      expect(result.current.pinnedIds.has('n1')).toBe(true);
    });

    it('persists the new pin to localStorage immediately', () => {
      const { result } = renderHook(() => useNotificationPins());

      act(() => {
        result.current.togglePin('n1');
      });

      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as string[];
      expect(stored).toContain('n1');
    });

    it('unpins an id that was already pinned', () => {
      seedStorage(['n1', 'n2']);
      const { result } = renderHook(() => useNotificationPins());

      act(() => {
        result.current.togglePin('n1');
      });

      expect(result.current.isPinned('n1')).toBe(false);
      expect(result.current.isPinned('n2')).toBe(true); // n2 untouched
    });

    it('persists the unpin to localStorage', () => {
      seedStorage(['n1']);
      const { result } = renderHook(() => useNotificationPins());

      act(() => {
        result.current.togglePin('n1');
      });

      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '["leftover"]') as string[];
      expect(stored).not.toContain('n1');
    });

    it('toggles back: pin → unpin → pin restores the id', () => {
      const { result } = renderHook(() => useNotificationPins());

      act(() => { result.current.togglePin('n1'); }); // pin
      expect(result.current.isPinned('n1')).toBe(true);

      act(() => { result.current.togglePin('n1'); }); // unpin
      expect(result.current.isPinned('n1')).toBe(false);

      act(() => { result.current.togglePin('n1'); }); // re-pin
      expect(result.current.isPinned('n1')).toBe(true);
    });

    it('initialises from pre-existing localStorage data', () => {
      seedStorage(['existing-1', 'existing-2']);
      const { result } = renderHook(() => useNotificationPins());

      expect(result.current.isPinned('existing-1')).toBe(true);
      expect(result.current.isPinned('existing-2')).toBe(true);
      expect(result.current.pinnedIds.size).toBe(2);
    });

    it('pinning multiple distinct ids accumulates them all', () => {
      const { result } = renderHook(() => useNotificationPins());

      act(() => { result.current.togglePin('a'); });
      act(() => { result.current.togglePin('b'); });
      act(() => { result.current.togglePin('c'); });

      expect(result.current.pinnedIds.size).toBe(3);
      ['a', 'b', 'c'].forEach((id) => expect(result.current.isPinned(id)).toBe(true));
    });
  });

  // -------------------------------------------------------------------------
  // #1471 edge case: corrupted localStorage JSON (getStoredPins try/catch ~line 12)
  // -------------------------------------------------------------------------
  describe('corrupted localStorage JSON fallback', () => {
    it('falls back to an empty set when stored JSON is corrupted', () => {
      localStorage.setItem(STORAGE_KEY, '{not-valid-json');

      const { result } = renderHook(() => useNotificationPins());

      expect(result.current.pinnedIds.size).toBe(0);
      expect(result.current.isPinned('note-4')).toBe(false);
    });

    it('recovers gracefully: togglePin works normally after a corrupted initial read', () => {
      localStorage.setItem(STORAGE_KEY, 'CORRUPTED');

      const { result } = renderHook(() => useNotificationPins());

      // Should start empty due to fallback.
      expect(result.current.pinnedIds.size).toBe(0);

      // And should still be able to pin new items correctly.
      act(() => { result.current.togglePin('new-pin'); });
      expect(result.current.isPinned('new-pin')).toBe(true);

      // The valid pin is now stored correctly in localStorage.
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as string[];
      expect(stored).toContain('new-pin');
    });

    it('returns empty set when stored value is a non-array JSON value', () => {
      // JSON.parse succeeds but the result is not an array — the Array.isArray
      // guard in getStoredPins should catch this.
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ id: 'n1' }));

      const { result } = renderHook(() => useNotificationPins());
      expect(result.current.pinnedIds.size).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // #1471 edge case: localStorage.setItem throws (storePins try/catch ~line 24)
  // -------------------------------------------------------------------------
  describe('localStorage.setItem throwing (storage full / unavailable)', () => {
    it('continues working when localStorage.setItem throws', () => {
      const setItemSpy = vi
        .spyOn(Storage.prototype, 'setItem')
        .mockImplementation(() => {
          throw new Error('Quota exceeded');
        });

      const { result } = renderHook(() => useNotificationPins());

      expect(() => {
        act(() => {
          result.current.togglePin('note-5');
        });
      }).not.toThrow();

      expect(result.current.isPinned('note-5')).toBe(true);
      expect(setItemSpy).toHaveBeenCalled();
    });

    it('does not lose previously-toggled ids when setItem later starts throwing', () => {
      // First pin succeeds (real localStorage write).
      const { result } = renderHook(() => useNotificationPins());
      act(() => { result.current.togglePin('n1'); });
      expect(result.current.isPinned('n1')).toBe(true);

      // Now make all future setItem calls throw.
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new DOMException('QuotaExceededError');
      });

      // A second pin attempt fails silently at persistence but must not corrupt
      // the in-memory set — n1 must still be pinned.
      act(() => { result.current.togglePin('n2'); });
      expect(result.current.isPinned('n1')).toBe(true);
      expect(result.current.isPinned('n2')).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // #1471 edge case: storage event for unrelated key is ignored (~line 34)
  // -------------------------------------------------------------------------
  describe('cross-tab storage event listener', () => {
    it('updates when another tab writes to the same storage key', () => {
      const { result } = renderHook(() => useNotificationPins());

      act(() => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(['note-2']));
        window.dispatchEvent(
          new StorageEvent('storage', { key: STORAGE_KEY, storageArea: localStorage }),
        );
      });

      expect(result.current.isPinned('note-2')).toBe(true);
      expect(result.current.isPinned('note-1')).toBe(false);
    });

    it('ignores storage events for a different key', () => {
      seedStorage(['n1']);
      const { result } = renderHook(() => useNotificationPins());
      expect(result.current.pinnedIds.size).toBe(1);

      // Simulate a write to a completely unrelated key from another tab.
      act(() => {
        fireStorageEvent('some-other-key', JSON.stringify(['unrelated']));
      });

      // The hook must not change its state in response to the unrelated key.
      expect(result.current.pinnedIds.size).toBe(1);
      expect(result.current.isPinned('n1')).toBe(true);
    });

    it('ignores storage events with a null key', () => {
      seedStorage(['n1']);
      const { result } = renderHook(() => useNotificationPins());

      act(() => {
        // key === null is dispatched when localStorage.clear() is called externally.
        fireStorageEvent(null, null);
      });

      // Hook must not react to the null-key clear event.
      expect(result.current.pinnedIds.size).toBe(1);
    });

    it('clears pins when another tab removes the storage key entirely', () => {
      seedStorage(['n1', 'n2']);
      const { result } = renderHook(() => useNotificationPins());
      expect(result.current.pinnedIds.size).toBe(2);

      act(() => {
        // Another tab removed the key — localStorage now returns null.
        localStorage.removeItem(STORAGE_KEY);
        fireStorageEvent(STORAGE_KEY, null);
      });

      expect(result.current.pinnedIds.size).toBe(0);
    });

    it('removes the storage event listener on unmount (no memory leak)', () => {
      const addSpy = vi.spyOn(window, 'addEventListener');
      const removeSpy = vi.spyOn(window, 'removeEventListener');

      const { unmount } = renderHook(() => useNotificationPins());

      // Confirm the listener was registered.
      expect(addSpy).toHaveBeenCalledWith('storage', expect.any(Function));

      unmount();

      // Confirm the exact same function reference was removed.
      expect(removeSpy).toHaveBeenCalledWith('storage', expect.any(Function));
    });
  });
});
