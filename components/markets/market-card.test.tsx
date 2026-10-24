import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import MarketCard from './market-card';

describe('MarketCard', () => {
  const market = {
    symbol: 'XLM',
    name: 'Stellar',
    price: '0.1234',
    supplyApy: '4.25',
    borrowApy: '6.50',
    position: '1234.56',
    available: '5000.00',
  };

  it('renders all fields', () => {
    render(<MarketCard market={market as any} onTrade={vi.fn()} />);

    expect(screen.getByText('XLM')).toBeInTheDocument();
    expect(screen.getByText('Stellar')).toBeInTheDocument();
    expect(screen.getByText('$0.1234')).toBeInTheDocument();
    expect(screen.getByText('4.25%')).toBeInTheDocument();
    expect(screen.getByText('6.50%')).toBeInTheDocument();
    expect(screen.getByText('$1,234.56')).toBeInTheDocument();
  });

  it('calls onTrade with the right market', () => {
    const onTrade = vi.fn();
    render(<MarketCard market={market as any} onTrade={onTrade} />);

    fireEvent.click(screen.getByText('Trade'));

    expect(onTrade).toHaveBeenCalledTimes(1);
    expect(onTrade).toHaveBeenCalledWith(market);
  });
});
