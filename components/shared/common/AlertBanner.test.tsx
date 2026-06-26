import React from 'react';
import userEvent from '@testing-library/user-event';
import { render, screen } from '@/test/test-utils';
import { describe, it, beforeEach, expect } from 'vitest';
import { AlertBanner } from './AlertBanner';

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

    expect(await screen.findByRole('region')).toBeInTheDocument();
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

    expect(screen.queryByText('Your next payment is due in 1 day.')).toBeNull();
    expect(window.localStorage.getItem('dashboard-alert-test')).toBe('dismissed');
  });
});
