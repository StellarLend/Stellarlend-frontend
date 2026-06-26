import React from 'react';
import userEvent from '@testing-library/user-event';
import { render, screen } from '@/test/test-utils';
import { describe, it, beforeEach, expect, vi } from 'vitest';
import { AlertBanner } from './AlertBanner';

describe('AlertBanner', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('renders an accessible region with a title and message (info variant)', async () => {
    render(
      <AlertBanner
        title="Next payment is due soon"
        message="$250.00 due in 4 days"
        severity="info"
        dismissKey="test-alert"
      />
    );

    expect(await screen.findByRole('region')).toBeInTheDocument();
    expect(screen.getByText('Next payment is due soon')).toBeInTheDocument();
    expect(screen.getByText('$250.00 due in 4 days')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /dismiss alert/i })).toBeInTheDocument();
    // aria-live should be polite for non-critical
    expect(screen.getByRole('region')).toHaveAttribute('aria-live', 'polite');
  });

  it('persists dismissal state through localStorage (critical variant)', async () => {
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

    expect(screen.queryByText('Your next payment is due in 1 day.')).toBeNull();
    expect(window.localStorage.getItem('dashboard-alert-test')).toBe('dismissed');
  });

  it('renders warning variant with correct label and polite aria-live', async () => {
    render(
      <AlertBanner
        title="Low balance"
        message="Your balance is below the minimum required."
        severity="warning"
        dismissKey="warning-test"
      />
    );
    // Confirm label text appears (Warning)
    expect(await screen.findByText('Warning')).toBeInTheDocument();
    // aria-live should be polite for warning
    expect(screen.getByRole('region')).toHaveAttribute('aria-live', 'polite');
  });

  it('renders critical variant with assertive aria-live', async () => {
    render(
      <AlertBanner
        title="Payment failed"
        message="Your recent payment could not be processed."
        severity="critical"
        dismissKey="critical-test"
      />
    );
    // Confirm label text appears (Critical)
    expect(await screen.findByText('Critical')).toBeInTheDocument();
    // aria-live should be assertive for critical
    expect(screen.getByRole('region')).toHaveAttribute('aria-live', 'assertive');
  });

  it('dismisses without a dismissKey and calls onDismiss callback', async () => {
    const onDismiss = vi.fn();
    render(
      <AlertBanner
        title="Info banner"
        message="Just an informational message."
        severity="info"
        onDismiss={onDismiss}
      />
    );
    const dismissButton = await screen.findByRole('button', { name: /dismiss alert/i });
    await userEvent.click(dismissButton);
    // Banner should be removed
    expect(screen.queryByRole('region')).toBeNull();
    // Callback should have been called once
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
