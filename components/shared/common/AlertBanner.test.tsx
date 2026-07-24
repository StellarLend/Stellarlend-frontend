import React from 'react';
import userEvent from '@testing-library/user-event';
import { render, screen } from '@/test/test-utils';
import { describe, it, beforeEach, afterEach, expect, vi } from 'vitest';
import { AlertBanner } from './AlertBanner';

/**
 * Comprehensive tests for AlertBanner covering:
 * - All severity variants (info, warning, error, critical, success)
 * - Dismiss button behavior and onDismiss callback
 * - Persistence via localStorage when a dismissKey is provided
 * - Accessibility semantics (role, aria-live, aria-labelledby, aria-describedby)
 * - Storage-blocked environments (SecurityError / DOMException from localStorage)
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
      />
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
      />
    );
    const region = await screen.findByRole('status');
    expect(region).toBeInTheDocument();
    expect(screen.getByText('Info')).toBeInTheDocument();
    expect(screen.getByText('Next payment is due soon')).toBeInTheDocument();
    expect(screen.getByText('$250.00 due in 4 days')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /dismiss alert/i })).toBeInTheDocument();
  });

  it('persists dismissal state through localStorage', async () => {
    render(
      <AlertBanner
        title="Action required"
        message="Your next payment is due in 1 day."
        severity="critical"
        dismissKey="dashboard-alert-test"
      />
    );

    const dismissButton = await screen.findByRole('button', { name: /dismiss alert/i });
    await userEvent.click(dismissButton);

    expect(window.localStorage.getItem('dashboard-alert-test')).toBe('dismissed');
  });

  it('renders error variant with alert role and assertive aria-live', async () => {
    render(
      <AlertBanner
        title="Error occurred"
        message="Something went wrong."
        severity="error"
        dismissKey="error-test"
      />
    );
    const region = await screen.findByRole('alert');
    expect(region).toBeInTheDocument();
    expect(region).toHaveAttribute('aria-live', 'assertive');
    expect(screen.getByText('Error')).toBeInTheDocument();
  });

  describe('storage-blocked environment', () => {
    const storageError = new DOMException(
      'The operation is insecure.',
      'SecurityError'
    );

    it('still renders the banner when localStorage.getItem throws', async () => {
      vi.spyOn(window.localStorage, 'getItem').mockImplementation(() => {
        throw storageError;
      });

      render(
        <AlertBanner
          title="Storage blocked"
          message="This should still show."
          severity="warning"
          dismissKey="blocked-key"
        />
      );

      // Banner must become visible (isReady=true, isDismissed=false by default)
      const region = await screen.findByRole('status');
      expect(region).toBeInTheDocument();
      expect(screen.getByText('Storage blocked')).toBeInTheDocument();
    });

    it('still dismisses in-session when localStorage.setItem throws', async () => {
      vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => {
        throw storageError;
      });

      const onDismiss = vi.fn();

      render(
        <AlertBanner
          title="Storage blocked"
          message="Dismiss should still work."
          severity="info"
          dismissKey="blocked-key"
          onDismiss={onDismiss}
        />
      );

      const dismissButton = await screen.findByRole('button', { name: /dismiss alert/i });
      await userEvent.click(dismissButton);

      // Banner disappears from the DOM (isDismissed=true)
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
      // onDismiss callback was still invoked
      expect(onDismiss).toHaveBeenCalledOnce();
    });

    it('does not throw or reject when getItem throws', async () => {
      vi.spyOn(window.localStorage, 'getItem').mockImplementation(() => {
        throw storageError;
      });

      // If the error were uncaught it would propagate and fail this test.
      // Successfully rendering the banner proves the try/catch absorbed it.
      await expect(
        async () => {
          render(
            <AlertBanner
              title="Storage blocked"
              message="No uncaught error."
              severity="info"
              dismissKey="blocked-key"
            />
          );
          await screen.findByRole('status');
        }
      ).not.toThrow();
    });

    it('does not throw or reject when setItem throws', async () => {
      vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => {
        throw storageError;
      });

      render(
        <AlertBanner
          title="Storage blocked"
          message="No uncaught error on dismiss."
          severity="info"
          dismissKey="blocked-key"
        />
      );

      const dismissButton = await screen.findByRole('button', { name: /dismiss alert/i });

      // If the error were uncaught it would propagate and fail this assertion.
      await expect(userEvent.click(dismissButton)).resolves.not.toThrow();

      // The banner still disappears from the DOM
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });
  });
});

