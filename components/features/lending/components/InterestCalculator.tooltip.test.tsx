import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import InterestCalculator from '@/components/features/lending/components/InterestCalculator';

// Mock the calculation quote function
vi.mock('@/lib/lending/quote', () => ({
  calculateQuote: vi.fn(() => ({ ok: true, result: {
    dailyEarnings: 1.23,
    totalEarnings: 12.34,
    monthlyPayment: 100.5,
    totalRepayment: 1200.75,
    totalEarnings: 12.34,
    dailyEarnings: 1.23,
  } })),
}));

test('renders help icons with tooltips', async () => {
  const data = { amount: 1000, interestRate: 5, duration: 30 } as any;
  render(<InterestCalculator data={data} type="lend" onCalculate={() => {}} />);

  // Wait for calculation to appear
  const helpIcon = await screen.findAllByLabelText('Help');
  // Expect at least one help icon (Daily Earnings)
  expect(helpIcon.length).toBeGreaterThan(0);

  // Hover over first help icon to show tooltip
  fireEvent.mouseOver(helpIcon[0]);
  const tooltip = await screen.findByText('Estimated earnings per day based on APR and amount.');
  expect(tooltip).toBeInTheDocument();
});
