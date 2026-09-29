// @vitest-environment jsdom

import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useNotificationPins } from './useNotificationPins';

const STORAGE_KEY = 'notification-pinned-ids';

describe('useNotificationPins', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

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
    const { result } = renderHook(() => useNotificationPins());

    act(() => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(['note-3']));
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: 'different-key',
          storageArea: localStorage,
        }),
      );
    });

    expect(result.current.isPinned('note-3')).toBe(false);
  });

  it('falls back to an empty set when stored JSON is corrupted', () => {
    localStorage.setItem(STORAGE_KEY, '{not-valid-json');

    const { result } = renderHook(() => useNotificationPins());

    expect(result.current.pinnedIds.size).toBe(0);
    expect(result.current.isPinned('note-4')).toBe(false);
  });

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
});
