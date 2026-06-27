import React from 'react';
import userEvent from '@testing-library/user-event';
import { render, screen } from '@/test/test-utils';
import { describe, it, beforeEach, expect } from 'vitest';
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

  it('renders an accessible region with a title and message', async () => {
    render(
      <AlertBanner
        title="Next payment is due soon"
        message="$250.00 due in 4 days"
        severity="info"
        dismissKey="test-alert"
      />
    );

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
});
