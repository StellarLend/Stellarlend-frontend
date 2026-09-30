import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useDebouncedValue } from '../useDebouncedValue';

describe('useDebouncedValue', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllTimers();
  });

  it('should return the initial value immediately', () => {
    const { result } = renderHook(() => useDebouncedValue('hello', 300));
    expect(result.current).toBe('hello');
  });

  it('should not update before the delay elapses', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebouncedValue(value, delay),
      { initialProps: { value: 'a', delay: 300 } }
    );

    expect(result.current).toBe('a');

    rerender({ value: 'b', delay: 300 });

    vi.advanceTimersByTime(200);
    expect(result.current).toBe('a');
  });

  it('should update after the delay elapses', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebouncedValue(value, delay),
      { initialProps: { value: 'a', delay: 300 } }
    );

    rerender({ value: 'b', delay: 300 });

    vi.advanceTimersByTime(300);
    expect(result.current).toBe('b');
  });

  it('should respect custom delay', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebouncedValue(value, delay),
      { initialProps: { value: 'a', delay: 500 } }
    );

    rerender({ value: 'b', delay: 500 });

    vi.advanceTimersByTime(400);
    expect(result.current).toBe('a');

    vi.advanceTimersByTime(100);
    expect(result.current).toBe('b');
  });

  it('should cancel previous timeout on rapid changes', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebouncedValue(value, delay),
      { initialProps: { value: 'a', delay: 300 } }
    );

    rerender({ value: 'b', delay: 300 });
    vi.advanceTimersByTime(100);

    rerender({ value: 'c', delay: 300 });
    vi.advanceTimersByTime(100);

    rerender({ value: 'd', delay: 300 });
    vi.advanceTimersByTime(299);
    expect(result.current).toBe('a');

    vi.advanceTimersByTime(1);
    expect(result.current).toBe('d');
  });

  it('should work with number values', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebouncedValue(value, delay),
      { initialProps: { value: 0, delay: 300 } }
    );

    rerender({ value: 42, delay: 300 });
    vi.advanceTimersByTime(300);
    expect(result.current).toBe(42);
  });

  it('should work with object values', () => {
    const initial = { name: 'test' };
    const updated = { name: 'updated' };

    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebouncedValue(value, delay),
      { initialProps: { value: initial, delay: 300 } }
    );

    rerender({ value: updated, delay: 300 });
    vi.advanceTimersByTime(300);
    expect(result.current).toEqual(updated);
  });

  it('should clean up timeout on unmount', () => {
    const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');
    const { result, rerender, unmount } = renderHook(
      ({ value, delay }) => useDebouncedValue(value, delay),
      { initialProps: { value: 'a', delay: 300 } }
    );

    rerender({ value: 'b', delay: 300 });
    unmount();

    expect(clearTimeoutSpy).toHaveBeenCalled();
    clearTimeoutSpy.mockRestore();
  });

  it('should handle delay changes', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebouncedValue(value, delay),
      { initialProps: { value: 'a', delay: 300 } }
    );

    rerender({ value: 'b', delay: 500 });
    vi.advanceTimersByTime(300);
    expect(result.current).toBe('a');

    vi.advanceTimersByTime(200);
    expect(result.current).toBe('b');
  });
});
