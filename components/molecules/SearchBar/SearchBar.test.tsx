import React from 'react';
import { render, screen, fireEvent } from '@/test/test-utils';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import SearchBar, { SearchBarProps } from './SearchBar';

describe('SearchBar Component', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  describe('Rendering', () => {
    it('should render the search input with default placeholder', () => {
      render(<SearchBar />);
      const input = screen.getByPlaceholderText('Search...');
      expect(input).toBeInTheDocument();
    });

    it('should render with custom placeholder', () => {
      const customPlaceholder = 'Search for token, asset, wallet address';
      render(<SearchBar placeholder={customPlaceholder} />);
      const input = screen.getByPlaceholderText(customPlaceholder);
      expect(input).toBeInTheDocument();
    });

    it('should render search icon by default', () => {
      const { container } = render(<SearchBar />);
      const svg = container.querySelector('svg');
      expect(svg).toBeInTheDocument();
    });

    it('should not render search icon when showSearchIcon is false', () => {
      const { container } = render(<SearchBar showSearchIcon={false} />);
      const svg = container.querySelector('svg');
      expect(svg).not.toBeInTheDocument();
    });

    it('should render with proper accessibility attributes', () => {
      const customLabel = 'Custom search label';
      render(<SearchBar ariaLabel={customLabel} />);
      const input = screen.getByLabelText(customLabel);
      expect(input).toBeInTheDocument();
    });

    it('should render with custom className', () => {
      const { container } = render(<SearchBar className="custom-class" />);
      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper).toHaveClass('custom-class');
    });

    it('should render input with type text', () => {
      render(<SearchBar />);
      const input = screen.getByPlaceholderText('Search...') as HTMLInputElement;
      expect(input.type).toBe('text');
    });

    it('should have displayName for debugging', () => {
      expect(SearchBar.displayName).toBe('SearchBar');
    });
  });

  describe('Input Value Management', () => {
    it('should update input value on change', () => {
      render(<SearchBar />);
      const input = screen.getByPlaceholderText('Search...') as HTMLInputElement;

      fireEvent.change(input, { target: { value: 'test query' } });
      expect(input.value).toBe('test query');
    });

    it('should set initial value', () => {
      render(<SearchBar initialValue="initial search" />);
      const input = screen.getByPlaceholderText('Search...') as HTMLInputElement;
      expect(input.value).toBe('initial search');
    });

    it('should display clear button only when value is present', () => {
      render(<SearchBar />);
      const input = screen.getByPlaceholderText('Search...') as HTMLInputElement;

      // Initially, no clear button
      expect(screen.queryByLabelText('Clear search input')).not.toBeInTheDocument();

      // After typing, clear button appears
      fireEvent.change(input, { target: { value: 'test' } });
      expect(screen.getByLabelText('Clear search input')).toBeInTheDocument();
    });

    it('should hide clear button when showClearButton is false', () => {
      render(<SearchBar showClearButton={false} initialValue="test" />);
      expect(screen.queryByLabelText('Clear search input')).not.toBeInTheDocument();
    });
  });

  describe('Search Callback with Debounce', () => {
    it('should call onSearch callback with debounce', () => {
      const onSearch = vi.fn();
      render(<SearchBar onSearch={onSearch} debounceDelay={300} />);
      const input = screen.getByPlaceholderText('Search...');

      fireEvent.change(input, { target: { value: 't' } });
      expect(onSearch).not.toHaveBeenCalled();

      vi.advanceTimersByTime(300);
      expect(onSearch).toHaveBeenCalledWith('t');
      expect(onSearch).toHaveBeenCalledTimes(1);
    });

    it('should cancel previous debounce on new input', () => {
      const onSearch = vi.fn();
      render(<SearchBar onSearch={onSearch} debounceDelay={300} />);
      const input = screen.getByPlaceholderText('Search...');

      fireEvent.change(input, { target: { value: 't' } });
      vi.advanceTimersByTime(150);

      fireEvent.change(input, { target: { value: 'te' } });
      vi.advanceTimersByTime(150);

      expect(onSearch).not.toHaveBeenCalled();

      vi.advanceTimersByTime(150);
      expect(onSearch).toHaveBeenCalledWith('te');
      expect(onSearch).toHaveBeenCalledTimes(1);
    });

    it('should respect custom debounce delay', () => {
      const onSearch = vi.fn();
      render(<SearchBar onSearch={onSearch} debounceDelay={500} />);
      const input = screen.getByPlaceholderText('Search...');

      fireEvent.change(input, { target: { value: 'test' } });
      vi.advanceTimersByTime(300);
      expect(onSearch).not.toHaveBeenCalled();

      vi.advanceTimersByTime(200);
      expect(onSearch).toHaveBeenCalledWith('test');
    });

    it('should call onSearch with empty string on clear', () => {
      const onSearch = vi.fn();
      render(<SearchBar onSearch={onSearch} initialValue="test" />);

      const clearButton = screen.getByLabelText('Clear search input') as HTMLButtonElement;
      fireEvent.click(clearButton);

      vi.advanceTimersByTime(300);
      expect(onSearch).toHaveBeenCalledWith('');
    });
  });

  describe('Clear Button Functionality', () => {
    it('should clear input value when clear button is clicked', () => {
      render(<SearchBar initialValue="test" />);
      const input = screen.getByPlaceholderText('Search...') as HTMLInputElement;

      const clearButton = screen.getByLabelText('Clear search input') as HTMLButtonElement;
      fireEvent.click(clearButton);

      expect(input.value).toBe('');
    });

    it('should call onClear callback when clear button is clicked', () => {
      const onClear = vi.fn();
      render(<SearchBar initialValue="test" onClear={onClear} />);

      const clearButton = screen.getByLabelText('Clear search input') as HTMLButtonElement;
      fireEvent.click(clearButton);

      expect(onClear).toHaveBeenCalledTimes(1);
    });

    it('should focus input after clearing', () => {
      render(<SearchBar initialValue="test" />);
      const input = screen.getByPlaceholderText('Search...');

      const clearButton = screen.getByLabelText('Clear search input') as HTMLButtonElement;
      fireEvent.click(clearButton);

      expect(input).toHaveFocus();
    });

    it('should hide clear button after clearing', () => {
      render(<SearchBar initialValue="test" />);

      const clearButton = screen.getByLabelText('Clear search input') as HTMLButtonElement;
      fireEvent.click(clearButton);

      expect(screen.queryByLabelText('Clear search input')).not.toBeInTheDocument();
    });
  });

  describe('Keyboard Shortcuts', () => {
    it('should focus input when "/" key is pressed', () => {
      render(<SearchBar />);
      const input = screen.getByPlaceholderText('Search...') as HTMLInputElement;

      input.blur();
      expect(input).not.toHaveFocus();

      fireEvent.keyDown(window, { key: '/', code: 'Slash' });
      expect(input).toHaveFocus();
    });

    it('should not trigger focus with Ctrl modifier', () => {
      render(<SearchBar />);
      const input = screen.getByPlaceholderText('Search...') as HTMLInputElement;

      input.blur();
      fireEvent.keyDown(window, { key: '/', code: 'Slash', ctrlKey: true });
      expect(input).not.toHaveFocus();
    });

    it('should not focus when slash shortcut is disabled', () => {
      render(<SearchBar enableSlashShortcut={false} />);
      const input = screen.getByPlaceholderText('Search...') as HTMLInputElement;

      input.blur();
      fireEvent.keyDown(window, { key: '/', code: 'Slash' });
      expect(input).not.toHaveFocus();
    });

    it('should show keyboard hint when empty and slash shortcut enabled', () => {
      const { container } = render(<SearchBar enableSlashShortcut={true} />);
      const kbd = container.querySelector('kbd');
      expect(kbd).toBeInTheDocument();
      expect(kbd).toHaveTextContent('/');
    });

    it('should hide keyboard hint when value is present', () => {
      const { container } = render(<SearchBar enableSlashShortcut={true} />);
      const input = screen.getByPlaceholderText('Search...');

      fireEvent.change(input, { target: { value: 'test' } });

      const kbd = container.querySelector('kbd');
      expect(kbd).not.toBeVisible();
    });
  });

  describe('Focus State and Styling', () => {
    it('should have focus ring styles', () => {
      render(<SearchBar />);
      const input = screen.getByPlaceholderText('Search...');

      expect(input).toHaveClass('focus:ring-2');
      expect(input).toHaveClass('focus:outline-none');
    });

    it('should have hover styles', () => {
      render(<SearchBar />);
      const input = screen.getByPlaceholderText('Search...');

      expect(input).toHaveClass('hover:border-[var(--New-outline,rgb(113,180,141))]');
    });

    it('should have visible focus on clear button', () => {
      render(<SearchBar initialValue="test" />);
      const clearButton = screen.getByLabelText('Clear search input');

      expect(clearButton).toHaveClass('focus:ring-2');
      expect(clearButton).toHaveClass('focus:outline-none');
    });
  });

  describe('Ref Forwarding', () => {
    it('should forward ref to input element', () => {
      const ref = React.createRef<HTMLInputElement>();
      render(<SearchBar ref={ref} />);

      expect(ref.current).toBeInstanceOf(HTMLInputElement);
      expect(ref.current?.type).toBe('text');
    });

    it('should allow direct ref manipulation', () => {
      const ref = React.createRef<HTMLInputElement>();
      render(<SearchBar ref={ref} />);

      ref.current?.focus();
      expect(ref.current).toHaveFocus();

      ref.current!.value = 'test value';
      expect(ref.current?.value).toBe('test value');
    });
  });

  describe('Edge Cases', () => {
    it('should handle rapid input changes', () => {
      const onSearch = vi.fn();
      render(<SearchBar onSearch={onSearch} debounceDelay={300} />);
      const input = screen.getByPlaceholderText('Search...');

      for (let i = 0; i < 10; i++) {
        fireEvent.change(input, { target: { value: 'a'.repeat(i + 1) } });
        vi.advanceTimersByTime(50);
      }

      expect(onSearch).not.toHaveBeenCalled();
      vi.advanceTimersByTime(300);
      expect(onSearch).toHaveBeenCalledOnce();
    });

    it('should handle special characters', () => {
      const onSearch = vi.fn();
      render(<SearchBar onSearch={onSearch} />);
      const input = screen.getByPlaceholderText('Search...');

      fireEvent.change(input, { target: { value: '@#$%^&*()' } });
      vi.advanceTimersByTime(300);
      expect(onSearch).toHaveBeenCalledWith('@#$%^&*()');
    });

    it('should handle very long input', () => {
      const longString = 'a'.repeat(1000);
      render(<SearchBar />);
      const input = screen.getByPlaceholderText('Search...') as HTMLInputElement;

      fireEvent.change(input, { target: { value: longString } });
      expect(input.value).toBe(longString);
    });

    it('should cleanup debounce timeout on unmount', () => {
      const onSearch = vi.fn();
      const { unmount } = render(
        <SearchBar onSearch={onSearch} debounceDelay={300} initialValue="test" />
      );

      unmount();
      vi.advanceTimersByTime(300);
      expect(onSearch).not.toHaveBeenCalled();
    });

    it('should handle empty string as initial value', () => {
      render(<SearchBar initialValue="" />);
      const input = screen.getByPlaceholderText('Search...') as HTMLInputElement;
      expect(input.value).toBe('');
    });

    it('should handle undefined props gracefully', () => {
      const props: SearchBarProps = {
        onSearch: undefined,
        onClear: undefined,
      };
      render(<SearchBar {...props} />);
      const input = screen.getByPlaceholderText('Search...');
      expect(input).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper aria-label', () => {
      render(<SearchBar ariaLabel="Search for items" />);
      const input = screen.getByLabelText('Search for items');
      expect(input).toBeInTheDocument();
    });

    it('should have proper type attribute', () => {
      render(<SearchBar />);
      const input = screen.getByPlaceholderText('Search...') as HTMLInputElement;
      expect(input.type).toBe('text');
    });

    it('should have clear button with proper title', () => {
      render(<SearchBar initialValue="test" />);
      const clearButton = screen.getByLabelText('Clear search input');
      expect(clearButton).toHaveAttribute('title', 'Clear search');
    });

    it('should have proper button type for clear button', () => {
      render(<SearchBar initialValue="test" />);
      const clearButton = screen.getByLabelText('Clear search input') as HTMLButtonElement;
      expect(clearButton.type).toBe('button');
    });
  });

  describe('Integration', () => {
    it('should work with form submission', () => {
      const onSubmit = vi.fn((e) => e.preventDefault());
      const onSearch = vi.fn();

      render(
        <form onSubmit={onSubmit}>
          <SearchBar onSearch={onSearch} />
        </form>
      );

      const input = screen.getByPlaceholderText('Search...');
      fireEvent.change(input, { target: { value: 'test' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      vi.advanceTimersByTime(300);
      expect(onSearch).toHaveBeenCalled();
    });

    it('should handle all props simultaneously', () => {
      const onSearch = vi.fn();
      const onClear = vi.fn();

      const ref = React.createRef<HTMLInputElement>();

      render(
        <SearchBar
          ref={ref}
          placeholder="Custom placeholder"
          onSearch={onSearch}
          onClear={onClear}
          debounceDelay={200}
          showClearButton={true}
          showSearchIcon={true}
          enableSlashShortcut={true}
          maxWidth="lg"
          initialValue="initial"
          ariaLabel="Custom aria label"
          className="custom-class"
        />
      );

      expect(screen.getByPlaceholderText('Custom placeholder')).toBeInTheDocument();
      expect(screen.getByLabelText('Custom aria label')).toBeInTheDocument();

      const input = ref.current as HTMLInputElement;
      expect(input).toHaveValue('initial');

      fireEvent.change(input, { target: { value: 'initial test' } });
      vi.advanceTimersByTime(200);
      expect(onSearch).toHaveBeenCalled();

      const clearButton = screen.getByLabelText('Clear search input') as HTMLButtonElement;
      fireEvent.click(clearButton);
      expect(onClear).toHaveBeenCalled();
    });

    it('should work with multiple instances', () => {
      const onSearch1 = vi.fn();
      const onSearch2 = vi.fn();

      render(
        <>
          <SearchBar placeholder="Search 1" onSearch={onSearch1} />
          <SearchBar placeholder="Search 2" onSearch={onSearch2} />
        </>
      );

      const inputs = screen.getAllByRole('textbox');
      expect(inputs).toHaveLength(2);

      fireEvent.change(inputs[0], { target: { value: 'test1' } });
      vi.advanceTimersByTime(300);
      expect(onSearch1).toHaveBeenCalledWith('test1');
      expect(onSearch2).not.toHaveBeenCalled();

      fireEvent.change(inputs[1], { target: { value: 'test2' } });
      vi.advanceTimersByTime(300);
      expect(onSearch2).toHaveBeenCalledWith('test2');
    });
  });

  describe('Default Props', () => {
    it('should use default debounce delay', () => {
      const onSearch = vi.fn();
      render(<SearchBar onSearch={onSearch} />);
      const input = screen.getByPlaceholderText('Search...');

      fireEvent.change(input, { target: { value: 'test' } });
      vi.advanceTimersByTime(299);
      expect(onSearch).not.toHaveBeenCalled();

      vi.advanceTimersByTime(1);
      expect(onSearch).toHaveBeenCalledWith('test');
    });

    it('should show clear button by default', () => {
      render(<SearchBar initialValue="test" />);
      expect(screen.getByLabelText('Clear search input')).toBeInTheDocument();
    });

    it('should show search icon by default', () => {
      const { container } = render(<SearchBar />);
      const svg = container.querySelector('svg');
      expect(svg).toBeInTheDocument();
    });

    it('should enable slash shortcut by default', () => {
      render(<SearchBar />);
      const input = screen.getByPlaceholderText('Search...');

      input.blur();
      fireEvent.keyDown(window, { key: '/', code: 'Slash' });
      expect(input).toHaveFocus();
    });
  });

  describe('Consolidation Guard (#504)', () => {
    it('legacy Searchbar file must not exist', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const legacy = path.resolve(
        __dirname,
        '../../shared/common/Searchbar.tsx',
      );
      expect(fs.existsSync(legacy)).toBe(false);
    });

    it('barrel should not re-export Searchbar from shared/common', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const barrel = path.resolve(
        __dirname,
        '../../shared/common/index.ts',
      );
      const content = fs.readFileSync(barrel, 'utf-8');
      expect(content).not.toContain('Searchbar');
    });
  });

  describe('Migration Coverage (legacy call-site props)', () => {
    it('should work with only placeholder prop (TopNav usage pattern)', () => {
      render(<SearchBar placeholder="Search for token, asset, wallet address" />);
      const input = screen.getByPlaceholderText('Search for token, asset, wallet address');
      expect(input).toBeInTheDocument();
    });

    it('should work with placeholder and onSearch props (legacy pattern)', () => {
      const onSearch = vi.fn();
      render(<SearchBar placeholder="Search markets…" onSearch={onSearch} />);
      const input = screen.getByPlaceholderText('Search markets…');

      fireEvent.change(input, { target: { value: 'XLM' } });
      vi.advanceTimersByTime(300);
      expect(onSearch).toHaveBeenCalledWith('XLM');
    });

    it('should support debounce delay matching legacy debounceMs behavior', () => {
      const onSearch = vi.fn();
      render(<SearchBar onSearch={onSearch} debounceDelay={500} />);
      const input = screen.getByPlaceholderText('Search...');

      fireEvent.change(input, { target: { value: 'stellar' } });
      vi.advanceTimersByTime(300);
      expect(onSearch).not.toHaveBeenCalled();

      vi.advanceTimersByTime(200);
      expect(onSearch).toHaveBeenCalledWith('stellar');
    });

    it('should support className prop for styling (legacy pattern)', () => {
      const { container } = render(
        <SearchBar className="legacy-search-class" />
      );
      expect(container.firstChild).toHaveClass('legacy-search-class');
    });

    it('should support clear button matching legacy handleClear behavior', () => {
      const onSearch = vi.fn();
      render(<SearchBar onSearch={onSearch} initialValue="active query" />);
      const input = screen.getByPlaceholderText('Search...') as HTMLInputElement;
      expect(input.value).toBe('active query');

      const clearButton = screen.getByLabelText('Clear search input');
      fireEvent.click(clearButton);

      vi.advanceTimersByTime(300);
      expect(onSearch).toHaveBeenCalledWith('');
      expect(input.value).toBe('');
    });

    it('should support keyboard Enter matching legacy handleKeyDown behavior', () => {
      const onSearch = vi.fn();
      render(<SearchBar onSearch={onSearch} />);
      const input = screen.getByPlaceholderText('Search...');

      fireEvent.change(input, { target: { value: 'search term' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      vi.advanceTimersByTime(300);
      expect(onSearch).toHaveBeenCalledWith('search term');
    });
  });
});
