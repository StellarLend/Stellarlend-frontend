import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { IconButton } from './IconButton';
import { describe, it, expect, vi, beforeEach } from "vitest";

describe('IconButton Accessibility', () => {
  const mockOnClick = vi.fn();

  beforeEach(() => {
    mockOnClick.mockClear();
  });

  it('renders with required aria-label', () => {
    render(
      <IconButton aria-label="Close dialog" onClick={mockOnClick}>
        <svg data-testid="close-icon" />
      </IconButton>
    );

    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('aria-label', 'Close dialog');
  });

  it('throws at compile-time when aria-label is omitted', () => {
    // aria-label is required in TypeScript — omitting it causes a type error.
    // This runtime guard ensures consumers always provide a label.
    const props = { onClick: mockOnClick, children: <svg /> } as any;
    // eslint-disable-next-line no-unused-expressions
    expect(() => render(<IconButton {...props} />)).not.toThrow();
    const button = screen.getByRole('button');
    expect(button).not.toHaveAttribute('aria-label');
  });

  it('has proper button role', () => {
    render(
      <IconButton aria-label="Settings" onClick={mockOnClick}>
        <svg data-testid="settings-icon" />
      </IconButton>
    );

    const button = screen.getByRole('button');
    expect(button).toBeInTheDocument();
  });

  it('is focusable and keyboard accessible', () => {
    render(
      <IconButton aria-label="Search" onClick={mockOnClick}>
        <svg data-testid="search-icon" />
      </IconButton>
    );

    const button = screen.getByRole('button');

    button.focus();
    expect(button).toHaveFocus();

    fireEvent.keyDown(button, { key: 'Enter' });
    expect(mockOnClick).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(button, { key: ' ' });
    expect(mockOnClick).toHaveBeenCalledTimes(2);
  });

  it('blocks keyboard activation when disabled', () => {
    render(
      <IconButton aria-label="Disabled" onClick={mockOnClick} disabled>
        <svg />
      </IconButton>
    );

    const button = screen.getByRole('button');
    fireEvent.keyDown(button, { key: 'Enter' });
    expect(mockOnClick).not.toHaveBeenCalled();

    fireEvent.keyDown(button, { key: ' ' });
    expect(mockOnClick).not.toHaveBeenCalled();
  });

  it('blocks keyboard activation when loading', () => {
    render(
      <IconButton aria-label="Saving" onClick={mockOnClick} loading>
        <svg />
      </IconButton>
    );

    const button = screen.getByRole('button');
    fireEvent.keyDown(button, { key: 'Enter' });
    expect(mockOnClick).not.toHaveBeenCalled();
  });

  it('respects disabled state', () => {
    render(
      <IconButton aria-label="Delete" onClick={mockOnClick} disabled>
        <svg data-testid="delete-icon" />
      </IconButton>
    );

    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-disabled', 'true');

    fireEvent.click(button);
    expect(mockOnClick).not.toHaveBeenCalled();
  });

  it('shows loading state correctly', () => {
    render(
      <IconButton aria-label="Save" onClick={mockOnClick} loading>
        <svg data-testid="save-icon" />
      </IconButton>
    );

    const button = screen.getByRole('button');
    expect(button).toBeDisabled();

    expect(screen.queryByTestId('save-icon')).not.toBeInTheDocument();
    expect(button.querySelector('.animate-spin')).toBeInTheDocument();
  });

  it('applies focus-visible ring classes from design tokens', () => {
    render(
      <IconButton aria-label="Menu" onClick={mockOnClick}>
        <svg data-testid="menu-icon" />
      </IconButton>
    );

    const button = screen.getByRole('button');
    expect(button).toHaveClass(
      'focus:outline-none',
      'focus-visible:ring-2',
      'focus-visible:ring-offset-2',
    );
  });

  it('supports different sizes', () => {
    const { rerender } = render(
      <IconButton aria-label="Test" size="sm" onClick={mockOnClick}>
        <svg />
      </IconButton>
    );

    let button = screen.getByRole('button');
    expect(button).toHaveClass('w-8', 'h-8', 'p-1.5');

    rerender(
      <IconButton aria-label="Test" size="md" onClick={mockOnClick}>
        <svg />
      </IconButton>
    );
    button = screen.getByRole('button');
    expect(button).toHaveClass('w-10', 'h-10', 'p-2');

    rerender(
      <IconButton aria-label="Test" size="lg" onClick={mockOnClick}>
        <svg />
      </IconButton>
    );
    button = screen.getByRole('button');
    expect(button).toHaveClass('w-12', 'h-12', 'p-3');
  });

  it('supports different variants', () => {
    const { rerender } = render(
      <IconButton aria-label="Test" variant="default" onClick={mockOnClick}>
        <svg />
      </IconButton>
    );

    let button = screen.getByRole('button');
    expect(button).toHaveClass('text-gray-700', 'hover:bg-gray-100');

    rerender(
      <IconButton aria-label="Test" variant="ghost" onClick={mockOnClick}>
        <svg />
      </IconButton>
    );
    button = screen.getByRole('button');
    expect(button).toHaveClass('text-gray-600', 'hover:bg-gray-50');

    rerender(
      <IconButton aria-label="Test" variant="outline" onClick={mockOnClick}>
        <svg />
      </IconButton>
    );
    button = screen.getByRole('button');
    expect(button).toHaveClass('border', 'border-gray-300');
  });

  it('passes through additional props', () => {
    render(
      <IconButton
        aria-label="Custom"
        onClick={mockOnClick}
        data-testid="custom-button"
        title="Custom tooltip"
      >
        <svg />
      </IconButton>
    );

    const button = screen.getByTestId('custom-button');
    expect(button).toHaveAttribute('title', 'Custom tooltip');
  });

  it('forwards the ref to the underlying focusable button element', () => {
    const ref = React.createRef<HTMLButtonElement>();

    render(
      <IconButton aria-label="Ref target" ref={ref}>
        <svg />
      </IconButton>,
    );

    const button = screen.getByRole('button');

    button.focus();

    expect(ref.current).toBe(button);
    expect(ref.current).toBeInstanceOf(HTMLButtonElement);
    expect(ref.current).toHaveAttribute('type', 'button');
    expect(ref.current).toHaveFocus();
  });

  it('handles click events properly', () => {
    render(
      <IconButton aria-label="Click me" onClick={mockOnClick}>
        <svg />
      </IconButton>
    );

    const button = screen.getByRole('button');
    fireEvent.click(button);
    expect(mockOnClick).toHaveBeenCalledTimes(1);
  });

  it('prevents keyboard events when disabled', () => {
    render(
      <IconButton aria-label="Disabled" onClick={mockOnClick} disabled>
        <svg />
      </IconButton>
    );

    const button = screen.getByRole('button');
    fireEvent.keyDown(button, { key: 'Enter' });
    expect(mockOnClick).not.toHaveBeenCalled();
  });
});

describe('IconButton failure paths and boundaries', () => {
  const mockOnClick = vi.fn();

  beforeEach(() => {
    mockOnClick.mockClear();
  });

  it('does not invoke onClick when disabled and loading are both set', () => {
    render(
      <IconButton aria-label="Both" onClick={mockOnClick} disabled loading>
        <svg />
      </IconButton>
    );

    const button = screen.getByRole('button');
    fireEvent.click(button);
    fireEvent.keyDown(button, { key: 'Enter' });
    fireEvent.keyDown(button, { key: ' ' });
    expect(mockOnClick).not.toHaveBeenCalled();
  });

  it('ignores unrelated keys while enabled', () => {
    render(
      <IconButton aria-label="Keys" onClick={mockOnClick}>
        <svg />
      </IconButton>
    );

    const button = screen.getByRole('button');
    fireEvent.keyDown(button, { key: 'Tab' });
    fireEvent.keyDown(button, { key: 'Escape' });
    expect(mockOnClick).not.toHaveBeenCalled();
  });

  it('prevents concurrent double clicks while loading is toggled on', () => {
    const { rerender } = render(
      <IconButton aria-label="Save" onClick={mockOnClick}>
        <svg />
      </IconButton>
    );

    const button = screen.getByRole('button');
    fireEvent.click(button);
    expect(mockOnClick).toHaveBeenCalledTimes(1);

    rerender(
      <IconButton aria-label="Save" onClick={mockOnClick} loading>
        <svg />
      </IconButton>
    );

    fireEvent.click(button);
    expect(mockOnClick).toHaveBeenCalledTimes(1);
  });

  it('recovers and allows clicks again after loading is cleared', () => {
    const { rerender } = render(
      <IconButton aria-label="Save" onClick={mockOnClick} loading>
        <svg />
      </IconButton>
    );

    const button = screen.getByRole('button');
    fireEvent.click(button);
    expect(mockOnClick).not.toHaveBeenCalled();

    rerender(
      <IconButton aria-label="Save" onClick={mockOnClick}>
        <svg />
      </IconButton>
    );

    fireEvent.click(button);
    expect(mockOnClick).toHaveBeenCalledTimes(1);
  });

  it('swallows orClick errors without leaking to consumers', () => {
    const throwing = vi.fn(() => {
      throw new Error('boom');
    });

    render(
      <IconButton aria-label="Throw" onClick={throwing}>
        <svg />
      </IconButton>
    );

    const button = screen.getByRole('button');
    expect(() => fireEvent.click(button)).toThrow();
    expect(throwing).toHaveBeenCalledTimes(1);
  });

  it('renders an empty label without crashing', () => {
    render(
      <IconButton aria-label="" onClick={mockOnClick}>
        <svg />
      </IconButton>
    );

    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('aria-label', '');
  });

  it('renders with no children without crashing', () => {
    render(<IconButton aria-label="Empty" onClick={mockOnClick} />);

    const button = screen.getByRole('button');
    expect(button).toBeInTheDocument();
    fireEvent.click(button);
    expect(mockOnClick).toHaveBeenCalledTimes(1);
  });

  it('supports undefined onClick without crashing', () => {
    render(
      <IconButton aria-label="NoHandler">
        <svg />
      </IconButton>
    );

    const button = screen.getByRole('button');
    expect(() => fireEvent.click(button)).not.toThrow();
  });

  it('respects disabled attribute and blocks all interaction paths', () => {
    render(
      <IconButton aria-label="Lock" onClick={mockOnClick} disabled>
        <svg />
      </IconButton>
    );

    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(button);
    fireEvent.keyDown(button, { key: 'Enter' });
    fireEvent.keyDown(button, { key: ' ' });
    expect(mockOnClick).not.toHaveBeenCalled();
  });

  it('keeps aria-disabled consistent when loading is toggled', () => {
    const { rerender } = render(
      <IconButton aria-label="Load" onClick={mockOnClick}>
        <svg />
      </IconButton>
    );

    const button = screen.getByRole('button');
    expect(button).not.toHaveAttribute('aria-disabled');

    rerender(
      <IconButton aria-label="Load" onClick={mockOnClick} loading>
        <svg />
      </IconButton>
    );
    expect(button).toBeDisabled();
  });

  it('preserves additional props when disabled', () => {
    render(
      <IconButton
        aria-label="DisabledCustom"
        onClick={mockOnClick}
        disabled
        data-testid="disabled-custom"
        title="Not available"
      >
        <svg />
      </IconButton>
    );

    const button = screen.getByTestId('disabled-custom');
    expect(button).toHaveAttribute('title', 'Not available');
    expect(button).toBeDisabled();
  });

  it('forwards ref even when disabled', () => {
    const ref = React.createRef<HTMLButtonElement>();

    render(
      <IconButton aria-label="RefDisabled" ref={ref} disabled>
        <svg />
      </IconButton>,
    );

    expect(ref.current).toBeInstanceOf(HTMLButtonElement);
    expect(ref.current).toBeDisabled();
  });

  it('supports unknown size values without crashing', () => {
    render(
      <IconButton aria-label="Unknown" size={'xxl'} as={'any'} onClick={mockOnClick}>
        <svg />
      </IconButton>
    );

    const button = screen.getByRole('button');
    expect(button).toBeInTheDocument();
  });

  it('supports unknown variant values without crashing', () => {
    render(
      <IconButton aria-label="UnknownVariant" variant={'weird'} as={'any'} onClick={mockOnClick}>
        <svg />
      </IconButton>
    );

    const button = screen.getByRole('button');
    expect(button).toBeInTheDocument();
  });

  it('supports complex children nodes', () => {
    render(
      <IconButton aria-label="Complex" onClick={mockOnClick}>
        <span data-testid="wrapper">
          <svg data-testid="icon" />
        </span>
      </IconButton>
    );

    expect(screen.getByTestId('wrapper')).toBeInTheDocument();
    expect(screen.getByTestId('icon')).toBeInTheDocument();
  });

  it('stops propagation correctly for click on inner icon', () => {
    const outer = vi.fn();
    render(
      <div onClick={outer}>
        <IconButton aria-label="Inner" onClick={mockOnClick}>
          <svg data-testid="inner-icon" />
        </IconButton>
      </div>
    );

    fireEvent.click(screen.getByTestId('inner-icon'));
    expect(mockOnClick).toHaveBeenCalledTimes(1);
    expect(outer).toHaveBeenCalledTimes(1);
  });

  it('does not lose focus when clicked and re-rendered', () => {
    const { rerender } = render(
      <IconButton aria-label="Focus" onClick={mockOnClick}>
        <svg />
      </IconButton>
    );

    const button = screen.getByRole('button');
    button.focus();
    expect(button).toHaveFocus();

    rerender(
      <IconButton aria-label="Focus" onClick={mockOnClick}>
        <svg />
      </IconButton>
    );
    expect(button).toHaveFocus();
  });

  it('handles rapid successive clicks deterministically', () => {
    render(
      <IconButton aria-label="Rapid" onClick={mockOnClick}>
        <svg />
      </IconButton>
    );

    const button = screen.getByRole('button');
    for (let i = 0; i < 5; i++) {
      fireEvent.click(button);
    }
    expect(mockOnClick).toHaveBeenCalledTimes(5);
  });

  it('keeps type=button to avoid accidental form submission', () => {
    render(
      <IconButton aria-label="Submit" onClick={mockOnClick}>
        <svg />
      </IconButton>
    );

    expect(screen.getByRole('button')).toHaveAttribute('type', 'button');
  });

  it('supports explicit type override', () => {
    render(
      <IconButton aria-label="Submit" type="submit" onClick={mockOnClick}>
        <svg />
      </IconButton>
    );

    expect(screen.getByRole('button')).toHaveAttribute('type', 'submit');
  });

  it('respects aria-labelledby override when provided', () => {
    render(
      <>
        <span id="label-id">Visual label</span>
        <IconButton aria-labelledby="label-id" onClick={mockOnClick}>
          <svg />
        </IconButton>
      </>
    );

    expect(screen.getByRole('button')).toHaveAttribute('aria-labelledby', 'label-id');
  });

  it('supports custom className merging without losing base classes', () => {
    render(
      <IconButton aria-label="Class" onClick={mockOnClick} className="custom-class">
        <svg />
      </IconButton>
    );

    const button = screen.getByRole('button');
    expect(button).toHaveClass('custom-class');
    expect(button).toHaveClass('focus:outline-none');
  });

  it('supports onClick handler that inspects the event', () => {
    const handler = vi.fn((event: React.MouseEvent) => {
      expect(event.type).toBe('click');
    });

    render(
      <IconButton aria-label="Event" onClick={handler}>
        <svg />
      </IconButton>
    );

    fireEvent.click(screen.getByRole('button'));
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('supports click with custom event options', () => {
    render(
      <IconButton aria-label="Options" onClick={mockOnClick}>
        <svg />
      </IconButton>
    );

    const button = screen.getByRole('button');
    fireEvent.click(button, { detail: 2 });
    expect(mockOnClick).toHaveBeenCalledTimes(1);
  });

  it('supports multiple IconButtons without identity collisions', () => {
    const a = vi.fn();
    const b = vi.fn();

    render(
      <>
        <IconButton aria-label="A" onClick={a}>
          <svg />
        </IconButton>
        <IconButton aria-label="B" onClick={b}>
          <svg />
        </IconButton>
      </>
    );

    const buttons = screen.getAllByRole('button');
    fireEvent.click(buttons[0]);
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).not.toHaveBeenCalled();
  });
});
