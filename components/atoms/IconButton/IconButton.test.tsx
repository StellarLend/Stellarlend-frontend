import { render, screen, fireEvent } from '@testing-library/react';
import { IconButton } from './IconButton';

describe('IconButton Accessibility', () => {
  const mockOnClick = jest.fn();

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
    
    // Test focus
    button.focus();
    expect(button).toHaveFocus();
    
    // Test keyboard interaction
    fireEvent.keyDown(button, { key: 'Enter' });
    expect(mockOnClick).toHaveBeenCalledTimes(1);
    
    fireEvent.keyDown(button, { key: ' ' });
    expect(mockOnClick).toHaveBeenCalledTimes(2);
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
    
    // Should not be clickable when disabled
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
    
    // Should show loading spinner instead of icon
    expect(screen.queryByTestId('save-icon')).not.toBeInTheDocument();
    expect(button.querySelector('.animate-spin')).toBeInTheDocument();
  });

  it('applies appropriate focus styles', () => {
    render(
      <IconButton aria-label="Menu" onClick={mockOnClick}>
        <svg data-testid="menu-icon" />
      </IconButton>
    );

    const button = screen.getByRole('button');
    expect(button).toHaveClass('focus:outline-none', 'focus:ring-2', 'focus:ring-blue-500', 'focus:ring-offset-1');
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

  it('prevents default action when disabled', () => {
    render(
      <IconButton aria-label="Disabled" onClick={mockOnClick} disabled>
        <svg />
      </IconButton>
    );

    const button = screen.getByRole('button');
    const clickEvent = new MouseEvent('click', { bubbles: true, cancelable: true });
    
    const defaultPrevented = !fireEvent(button, clickEvent);
    expect(defaultPrevented).toBe(true);
    expect(mockOnClick).not.toHaveBeenCalled();
  });
});
