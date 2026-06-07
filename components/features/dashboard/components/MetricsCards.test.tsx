import { render, screen } from '@testing-library/react';
import MetricsCards from '@/components/features/dashboard/components/MetricsCards';

// Mock fetch for metric data
global.fetch = vi.fn(() =>
  Promise.resolve({
    json: () => Promise.resolve({
      availableBalance: '1,000 XLM',
      copyAddress: 'GABCDEF1234567890',
      borrowedAmount: '500 XLM',
      nextDue: '2024-12-31',
      suppliedFunds: '2,000 XLM',
      healthFactor: '1.5',
      earnings: '50 XLM',
    }),
  }) as any
);

test('renders three metric cards and uses responsive grid classes', async () => {
  render(<MetricsCards />);

  // Wait for data to load
  const cards = await screen.findAllByRole('heading', { level: 3 });
  expect(cards).toHaveLength(3);

  // Verify grid container has Tailwind responsive classes
  const grid = screen.getByRole('region', { name: /Scrollable metrics/i }).firstChild as HTMLElement;
  expect(grid).toHaveClass('grid', 'grid-cols-1', 'sm:grid-cols-2', 'lg:grid-cols-3');
});
