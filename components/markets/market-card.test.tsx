import { render, screen, fireEvent } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { NextIntlClientProvider } from 'next-intl';
import enMessages from '@/messages/en.json';
import esMessages from '@/messages/es.json';
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

  const renderCard = (locale: 'en' | 'es', props: Partial<ComponentProps<typeof MarketCard>> = {}) =>
    render(
      <NextIntlClientProvider locale={locale} messages={locale === 'es' ? esMessages : enMessages}>
        <MarketCard market={market} locale={locale} onTrade={vi.fn()} {...props} />
      </NextIntlClientProvider>
    );

  it('renders en values', () => {
    renderCard('en');

    expect(screen.getByText(market.symbol)).toBeInTheDocument();
    expect(screen.getByText(market.name)).toBeInTheDocument();
    expect(screen.getByText(formatCurrency(market.price, 'en'))).toBeInTheDocument();
    expect(screen.getByText(formatPercent(market.supplyApy, 'en'))).toBeInTheDocument();
    expect(screen.getByText(formatPercent(market.borrowApy, 'en'))).toBeInTheDocument();
    expect(screen.getByText(enMessages.market.supplyApy)).toBeInTheDocument();
    expect(screen.getByText(enMessages.market.borrowApy)).toBeInTheDocument();
    expect(screen.getByText(enMessages.market.trade)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: `${enMessages.market.trade} ${market.symbol}` })).toBeInTheDocument();
  });

  it('renders es values', () => {
    renderCard('es', { supplied: 1234.5, borrowed: 42.5 });

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
    expect(screen.getByText(esMessages.market.trade)).toBeInTheDocument();
    expect(screen.getByText(esMessages.market.supplied)).toBeInTheDocument();
    expect(screen.getByText(esMessages.market.borrowed)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: `${esMessages.market.trade} ${market.symbol}` })).toBeInTheDocument();
  });

  it('hides supplied and borrowed when null', () => {
    const { rerender } = renderCard('en', { supplied: null, borrowed: null });

    expect(screen.queryByText('Supplied')).not.toBeInTheDocument();
    expect(screen.queryByText('Borrowed')).not.toBeInTheDocument();

    rerender(
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <MarketCard market={market} locale="en" supplied={0} borrowed={0} onTrade={vi.fn()} />
      </NextIntlClientProvider>
    );

    expect(screen.getByText(enMessages.market.supplied)).toBeInTheDocument();
    expect(screen.getByText(enMessages.market.borrowed)).toBeInTheDocument();
    expect(screen.getAllByText(formatNumber(0, 'en', 4))).toHaveLength(2);

    rerender(
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <MarketCard market={market} locale="en" supplied={1234.5678} borrowed={42.5} onTrade={vi.fn()} />
      </NextIntlClientProvider>
    );

    expect(screen.getByText(formatNumber(1234.5678, 'en', 4))).toBeInTheDocument();
    expect(screen.getByText(formatNumber(42.5, 'en', 4))).toBeInTheDocument();
  });

  it('calls onTrade with market', () => {
    const onTrade = vi.fn();
    render(
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <MarketCard market={market} locale="en" onTrade={onTrade} />
      </NextIntlClientProvider>
    );

    fireEvent.click(screen.getByRole('button', { name: `${enMessages.market.trade} ${market.symbol}` }));

    expect(onTrade).toHaveBeenCalledTimes(1);
    expect(onTrade).toHaveBeenCalledWith(market);
  });
});
