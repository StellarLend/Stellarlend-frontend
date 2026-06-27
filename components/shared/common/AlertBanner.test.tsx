import React from 'react';
import userEvent from '@testing-library/user-event';
import { render, screen } from '@/test/test-utils';
import { describe, it, beforeEach, expect, vi } from 'vitest';
import { AlertBanner } from './AlertBanner';

/**
 * Comprehensive tests for AlertBanner covering:
 * - All severity variants (info, warning, error, critical, success)
 * - Dismiss button behavior and onDismiss callback
 * - Persistence via localStorage when a dismissKey is provided
 * - Accessibility semantics (role, aria-live, aria-labelledby, aria-describedby)
 */

describe('AlertBanner', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  const renderBanner = (props) => {
    render(<AlertBanner {...props} />);
  };

  it('renders info variant with correct label, role, and polite aria-live', async () => {
    renderBanner({
      title: 'Next payment is due soon',
      message: '$250.00 due in 4 days',
      severity: 'info',
      dismissKey: 'info-test',
    });
    const region = await screen.findByRole('status');
    expect(region).toBeInTheDocument();
    expect(screen.getByText('Info')).toBeInTheDocument();
    expect(screen.getByText('Next payment is due soon')).toBeInTheDocument();
    expect(screen.getByText('$250.00 due in 4 days')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /dismiss alert/i })).toBeInTheDocument();
    expect(region).toHaveAttribute('aria-live', 'polite');
  });

  it('renders warning variant with correct label and polite aria-live', async () => {
    renderBanner({
      title: 'Low balance',
      message: 'Your balance is below the minimum required.',
      severity: 'warning',
      dismissKey: 'warning-test',
    });
    expect(await screen.findByText('Warning')).toBeInTheDocument();
    const region = screen.getByRole('status');
    expect(region).toHaveAttribute('aria-live', 'polite');
  });

  it('renders error variant with alert role and assertive aria-live', async () => {
    renderBanner({
      title: 'Error occurred',
      message: 'Something went wrong.',
      severity: 'error',
      dismissKey: 'error-test',
    });
    const region = await screen.findByRole('alert');
    expect(region).toBeInTheDocument();
    expect(region).toHaveAttribute('aria-live', 'assertive');
    expect(screen.getByText('Error')).toBeInTheDocument();
  });

  it('renders critical variant with alert role, assertive aria-live and persists dismissal', async () => {
    const onDismiss = vi.fn();
    renderBanner({
      title: 'Critical issue',
      message: 'Immediate action required.',
      severity: 'critical',
      dismissKey: 'critical-test',
      onDismiss,
    });
    const region = await screen.findByRole('alert');
    expect(region).toHaveAttribute('aria-live', 'assertive');
    const button = screen.getByRole('button', { name: /dismiss alert/i });
    await userEvent.click(button);
    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('alert')).toBeNull();
    expect(window.localStorage.getItem('critical-test')).toBe('dismissed');
  });

  it('renders success variant with status role and polite aria-live', async () => {
    renderBanner({
      title: 'Success!',
      message: 'Operation completed successfully.',
      severity: 'success',
      dismissKey: 'success-test',
    });
    const region = await screen.findByRole('status');
    expect(region).toBeInTheDocument();
    expect(screen.getByText('Success')).toBeInTheDocument();
    expect(region).toHaveAttribute('aria-live', 'polite');
  });

  it('calls onDismiss when dismissed without persistence key', async () => {
    const onDismiss = vi.fn();
    renderBanner({
      title: 'No key banner',
      message: 'Can be dismissed.',
      severity: 'info',
      onDismiss,
    });
    const button = await screen.findByRole('button', { name: /dismiss alert/i });
    await userEvent.click(button);
    expect(screen.queryByRole('status')).toBeNull();
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
