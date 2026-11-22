import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect as vitestExpect, it } from 'vitest';
import { axe } from 'vitest-axe';
import { NextIntlClientProvider } from 'next-intl';
import MarketsApp from './markets-app';
import messages from '@/messages/en.json';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const expect = vitestExpect as any;

function renderMarketsApp() {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <MarketsApp />
    </NextIntlClientProvider>
  );
}

describe('MarketsApp accessibility (vitest-axe)', () => {
  it('has no accessibility violations in initial state', async () => {
    const { container } = renderMarketsApp();
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('has no accessibility violations when trade panel is open and moves focus to heading', async () => {
    const user = userEvent.setup();
    const { container } = renderMarketsApp();

    const tradeButton = screen.getByRole('button', { name: 'Trade XLM' });
    await user.click(tradeButton);

    const panelHeading = screen.getByRole('heading', { level: 2, name: 'XLM' });
    expect(panelHeading).toBeInTheDocument();
    expect(panelHeading).toHaveFocus();

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('has no accessibility violations when displaying an error message', async () => {
    const user = userEvent.setup();
    const { container } = renderMarketsApp();

    const tradeButton = screen.getByRole('button', { name: 'Trade XLM' });
    await user.click(tradeButton);

    const input = screen.getByRole('textbox', { name: 'Amount in XLM' });
    await user.type(input, '-1');

    const confirmButton = screen.getByRole('button', { name: 'Confirm Supply' });
    await user.click(confirmButton);

    const alertMessage = screen.getByRole('alert');
    expect(alertMessage).toBeInTheDocument();

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('has no accessibility violations when displaying a success message', async () => {
    const user = userEvent.setup();
    const { container } = renderMarketsApp();

    const tradeButton = screen.getByRole('button', { name: 'Trade XLM' });
    await user.click(tradeButton);

    const input = screen.getByRole('textbox', { name: 'Amount in XLM' });
    await user.type(input, '10');

    const confirmButton = screen.getByRole('button', { name: 'Confirm Supply' });
    await user.click(confirmButton);

    const statusMessage = screen.getByRole('status');
    expect(statusMessage).toBeInTheDocument();
    expect(statusMessage).toHaveTextContent(/Supply of 10 XLM recorded/i);

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('supports full keyboard navigation: selecting asset, switching actions with arrow keys, entering amount and submitting', async () => {
    const user = userEvent.setup();
    renderMarketsApp();

    const tradeButton = screen.getByRole('button', { name: 'Trade XLM' });
    tradeButton.focus();
    expect(tradeButton).toHaveFocus();
    await user.keyboard('{Enter}');

    const panelHeading = screen.getByRole('heading', { level: 2, name: 'XLM' });
    expect(panelHeading).toHaveFocus();

    // Tab into tablist
    await user.tab();
    const supplyTab = screen.getByRole('tab', { name: 'Supply' });
    expect(supplyTab).toHaveFocus();
    expect(supplyTab).toHaveAttribute('aria-selected', 'true');

    // Arrow navigation
    await user.keyboard('{ArrowRight}');
    const borrowTab = screen.getByRole('tab', { name: 'Borrow' });
    expect(borrowTab).toHaveFocus();
    expect(borrowTab).toHaveAttribute('aria-selected', 'true');
    expect(supplyTab).toHaveAttribute('aria-selected', 'false');

    await user.keyboard('{ArrowRight}');
    const withdrawTab = screen.getByRole('tab', { name: 'Withdraw' });
    expect(withdrawTab).toHaveFocus();
    expect(withdrawTab).toHaveAttribute('aria-selected', 'true');

    await user.keyboard('{ArrowLeft}');
    expect(borrowTab).toHaveFocus();
    expect(borrowTab).toHaveAttribute('aria-selected', 'true');

    // Tab into panel
    await user.tab();
    const xlmInput = screen.getByRole('textbox', { name: 'Amount in XLM' });
    expect(xlmInput).toBeInTheDocument();
    xlmInput.focus();
    await user.keyboard('5');

    // Tab to submit button
    const confirmButton = screen.getByRole('button', { name: 'Confirm Borrow' });
    confirmButton.focus();
    expect(confirmButton).toHaveFocus();
    await user.keyboard('{Enter}');

    const message = screen.getByText(/Borrow of 5 XLM recorded|Borrow exceeds/i);
    expect(message).toBeInTheDocument();
  });
});
