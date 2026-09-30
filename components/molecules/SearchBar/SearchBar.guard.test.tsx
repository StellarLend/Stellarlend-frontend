import React from 'react';
import { render, screen, fireEvent } from '@/test/test-utils';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import SearchBar from './SearchBar';

describe('SearchBar Guard Features', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  describe('Max Input Length', () => {
    it('should truncate input that exceeds max length', () => {
      const maxLength = 10;
      const longString = 'a'.repeat(20);
      render(<SearchBar maxLength={maxLength} />);
      const input = screen.getByPlaceholderText('Search...') as HTMLInputElement;

      fireEvent.change(input, { target: { value: longString } });
      expect(input.value).toBe(longString.slice(0, maxLength));
    });

    it('should display length hint when near max length', () => {
      const maxLength = 20;
      render(<SearchBar maxLength={maxLength} />);
      const input = screen.getByPlaceholderText('Search...') as HTMLInputElement;

      fireEvent.change(input, { target: { value: 'a'.repeat(18) } });
      expect(screen.getByText('18/20')).toBeInTheDocument();
    });

    it('should show red border when at max length', () => {
      const maxLength = 10;
      render(<SearchBar maxLength={maxLength} />);
      const input = screen.getByPlaceholderText('Search...') as HTMLInputElement;

      fireEvent.change(input, { target: { value: 'a'.repeat(10) } });
      expect(input).toHaveClass('border-red-500');
    });

    it('should use default max length when not specified', () => {
      const defaultMaxLength = 200;
      render(<SearchBar />);
      const input = screen.getByPlaceholderText('Search...') as HTMLInputElement;

      fireEvent.change(input, { target: { value: 'a'.repeat(250) } });
      expect(input.value.length).toBe(defaultMaxLength);
    });
  });

  describe('Input Sanitization', () => {
    it('should strip control characters from input', () => {
      const onSearch = vi.fn();
      // String with control characters (null, bell, newline)
      const unsanitized = 'test\u0000\u0007\nquery';
      const expected = 'testquery'; // sanitiseString removes \p{C}
      render(<SearchBar onSearch={onSearch} />);
      const input = screen.getByPlaceholderText('Search...') as HTMLInputElement;

      fireEvent.change(input, { target: { value: unsanitized } });
      vi.advanceTimersByTime(300);

      expect(onSearch).toHaveBeenCalledWith(expected);
      expect(input.value).toBe(expected);
    });
  });

  describe('Debounce / Rate Guard', () => {
    it('should still debounce search with rapid input', () => {
      const onSearch = vi.fn();
      render(<SearchBar onSearch={onSearch} debounceDelay={300} />);
      const input = screen.getByPlaceholderText('Search...') as HTMLInputElement;

      for (let i = 0; i < 20; i++) {
        fireEvent.change(input, { target: { value: `query${i}` } });
      }

      vi.advanceTimersByTime(250);
      expect(onSearch).not.toHaveBeenCalled();

      vi.advanceTimersByTime(50);
      expect(onSearch).toHaveBeenCalledTimes(1);
      expect(onSearch).toHaveBeenCalledWith('query19');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty query correctly', () => {
      const onSearch = vi.fn();
      render(<SearchBar onSearch={onSearch} initialValue="test" />);
      const clearButton = screen.getByLabelText('Clear search input') as HTMLButtonElement;
      fireEvent.click(clearButton);

      vi.advanceTimersByTime(300);
      expect(onSearch).toHaveBeenCalledWith('');
    });

    it('should handle 0% max length (0) gracefully', () => {
      const onSearch = vi.fn();
      render(<SearchBar onSearch={onSearch} maxLength={0} />);
      const input = screen.getByPlaceholderText('Search...') as HTMLInputElement;

      fireEvent.change(input, { target: { value: 'test' } });
      vi.advanceTimersByTime(300);

      expect(input.value).toBe('');
      expect(onSearch).toHaveBeenCalledWith('');
    });
  });
});
