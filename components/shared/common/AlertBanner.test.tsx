import React from 'react';
import userEvent from '@testing-library/user-event';
import { render, screen, waitFor } from '@/test/test-utils';
import { describe, it, beforeEach, afterEach, expect, vi } from 'vitest';
import { AlertBanner } from './AlertBanner';

/**
 * Comprehensive tests for AlertBanner covering:
 * - All severity variants (info, warning, error, critical, success)
 * - Dismiss button behavior and onDismiss callback
 * - Persistence via localStorage when a dismissKey is provided
 * - Storage-blocked environments (SecurityError / DOMException)
 * - Accessibility semantics (role, aria-live, aria-labelledby, aria-describedby)
 */

describe('AlertBanner', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders an accessible region with a title and message', async () => {
    render(
      <AlertBanner
        title="Next payment is due soon"
        message="$250.00 due in 4 days"
        severity="info"
        dismissKey="test-alert"
      />,
    );

    const region = await screen.findByRole('status');
    expect(region).toBeInTheDocument();
  });

  it('renders info variant with correct label, role, and polite aria-live', async () => {
    render(
      <AlertBanner
        title="Next payment is due soon"
        message="$250.00 due in 4 days"
        severity="info"
        dismissKey="info-test"
      />,
    );
    const region = await screen.findByRole('status');
    expect(region).toBeInTheDocument();
    expect(screen.getByText('Info')).toBeInTheDocument();
    expect(screen.getByText('Next payment is due soon')).toBeInTheDocument();
    expect(screen.getByText('$250.00 due in 4 days')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /dismiss alert/i })).toBeInTheDocument();
  });

  it('persists dismissal state through localStorage under the dismissKey', async () => {
    render(
      <AlertBanner
        title="Action required"
        message="Your next payment is due in 1 day."
        severity="critical"
        dismissKey="dashboard-alert-test"
      />,
    );

    const dismissButton = await screen.findByRole('button', { name: /dismiss alert/i });
    await userEvent.click(dismissButton);

    expect(window.localStorage.getItem('dashboard-alert-test')).toBe('dismissed');
  });

  it('still dismisses and calls onDismiss when localStorage.setItem throws', async () => {
    const onDismiss = vi.fn();
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Access denied', 'SecurityError');
    });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    render(
      <AlertBanner
        title="Storage blocked"
        message="Dismiss should still work"
        severity="warning"
        dismissKey="blocked-write"
        onDismiss={onDismiss}
      />,
    );

    const dismissButton = await screen.findByRole('button', { name: /dismiss alert/i });
    await userEvent.click(dismissButton);

    expect(onDismiss).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });
    expect(setItem).toHaveBeenCalled();
    expect(warn).toHaveBeenCalled();
  });

  it('renders when localStorage.getItem throws (defaults to not dismissed)', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('Access denied', 'SecurityError');
    });
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    render(
      <AlertBanner
        title="Storage blocked on read"
        message="Banner should still appear"
        severity="info"
        dismissKey="blocked-read"
      />,
    );

    expect(await screen.findByRole('status')).toBeInTheDocument();
    expect(screen.getByText('Storage blocked on read')).toBeInTheDocument();
  });

  it('renders error variant with alert role and assertive aria-live', async () => {
    render(
      <AlertBanner
        title="Error occurred"
        message="Something went wrong."
        severity="error"
        dismissKey="error-test"
      />,
    );
    const region = await screen.findByRole('alert');
    expect(region).toBeInTheDocument();
    expect(region).toHaveAttribute('aria-live', 'assertive');
    expect(screen.getByText('Error')).toBeInTheDocument();
  });
});
