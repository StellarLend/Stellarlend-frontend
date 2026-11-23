import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import {
  MARKETS,
  formatCurrency,
  formatNumber,
  formatPercent,
  type Market,
} from '@/lib/markets';
import MarketCard from './market-card';

describe('MarketCard', () => {
  const market: Market = { ...MARKETS[0] };

  it('renders en values', () => {
    render(<MarketCard market={market} locale="en" onTrade={vi.fn()} />);

    expect(screen.getByText(market.symbol)).toBeInTheDocument();
    expect(screen.getByText(market.name)).toBeInTheDocument();
    expect(screen.getByText(formatCurrency(market.price, 'en'))).toBeInTheDocument();
    expect(screen.getByText(formatPercent(market.supplyApy, 'en'))).toBeInTheDocument();
    expect(screen.getByText(formatPercent(market.borrowApy, 'en'))).toBeInTheDocument();
  });

  it('renders es values', () => {
    render(<MarketCard market={market} locale="es" onTrade={vi.fn()} />);

    const expectedPrice = formatCurrency(market.price, 'es');
    const expectedSupplyApy = formatPercent(market.supplyApy, 'es');
    const expectedBorrowApy = formatPercent(market.borrowApy, 'es');

    expect(expectedPrice).toContain(',');
    expect(expectedSupplyApy).toContain(',');
    expect(expectedBorrowApy).toContain(',');

    const exact = { normalizer: (text: string) => text };
    expect(screen.getByText(expectedPrice, exact)).toBeInTheDocument();
    expect(screen.getByText(expectedSupplyApy, exact)).toBeInTheDocument();
    expect(screen.getByText(expectedBorrowApy, exact)).toBeInTheDocument();
  });

  it('hides supplied and borrowed when null', () => {
    const { rerender } = render(
      <MarketCard market={market} supplied={null} borrowed={null} onTrade={vi.fn()} />
    );

    expect(screen.queryByText('Supplied')).not.toBeInTheDocument();
    expect(screen.queryByText('Borrowed')).not.toBeInTheDocument();

    rerender(<MarketCard market={market} supplied={0} borrowed={0} onTrade={vi.fn()} />);

    expect(screen.getByText('Supplied')).toBeInTheDocument();
    expect(screen.getByText('Borrowed')).toBeInTheDocument();
    expect(screen.getAllByText(formatNumber(0, 'en', 4))).toHaveLength(2);

    rerender(
      <MarketCard market={market} supplied={1234.5678} borrowed={42.5} onTrade={vi.fn()} />
    );

    expect(screen.getByText(formatNumber(1234.5678, 'en', 4))).toBeInTheDocument();
    expect(screen.getByText(formatNumber(42.5, 'en', 4))).toBeInTheDocument();
  });

  it('calls onTrade with market', () => {
    const onTrade = vi.fn();
    render(<MarketCard market={market} onTrade={onTrade} />);

    fireEvent.click(screen.getByRole('button', { name: 'Trade XLM' }));

    expect(onTrade).toHaveBeenCalledTimes(1);
    expect(onTrade).toHaveBeenCalledWith(market);
  });
});
