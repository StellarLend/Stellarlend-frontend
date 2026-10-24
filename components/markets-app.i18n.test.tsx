import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { NextIntlClientProvider } from 'next-intl';
import MarketsApp from './markets-app';

vi.mock('@/lib/lending-client', () => ({
  isOnChainConfigured: () => false,
  readPosition: async () => null,
  submitLendingAction: async () => ({ status: 'failed', hash: null, error: null }),
}));

const messages = {
  market: {
    title: 'Mercados',
    subtitle: 'Posiciones simuladas.',
    wallet: 'Cartera',
    demoMode: 'Modo demo (sin cartera conectada)',
    collateral: 'Colateral',
    borrowed: 'Prestado',
    health: 'Salud',
    nA: 'n/a',
    asset: 'Activo',
    price: 'Precio',
    supplyApy: 'APY de depósito',
    borrowApy: 'APY de préstamo',
    totalSupplied: 'Total suministrado',
    yourPosition: 'Tu posición',
    trade: 'Operar',
    comingSoon: 'Próximamente',
    onchainMode: 'Modo on-chain (testnet de Stellar)',
    xlmAmount: '{amount} XLM',
    viewTx: 'Ver transacción',
    confirm: 'Confirmar {action}',
    supply: 'depositar',
    borrow: 'pedir prestado',
    withdraw: 'retirar',
    repay: 'pagar',
    amountIn: 'Cantidad en {symbol}',
    connectFreighter: 'Conectar Freighter',
    contract: 'Contrato de préstamo',
    notDeployed: 'no desplegado',
    resetDemo: 'Restablecer datos',
    status: {
      positiveAmount: 'Introduce una cantidad mayor que cero.',
      exceedsSupply: 'No puedes retirar más de lo suministrado.',
      exceedsBorrowLimit: 'El préstamo supera tu límite de endeudamiento.',
      exceedsBorrowed: 'No puedes pagar más de lo prestado.',
      underCollateralised: 'La retirada dejaría tu posición infracolateralizada.',
      recorded: '{action} de {amount} {symbol} registrado (libro de demostración).',
      pending: 'Transacción pendiente…',
      confirmed: 'Transacción confirmada.',
      failed: 'La transacción falló.',
      cancelled: 'Transacción cancelada en tu cartera.',
      timedOut: 'La transacción agotó el tiempo de espera.',
      positionError: 'No se pudo cargar tu posición on-chain.',
      demoFallback: 'Se muestra el libro de demostración.',
      loadingPosition: 'Cargando posición on-chain…',
    },
    oracle: {
      title: 'Precios de oráculo en cadena',
      subtitle: 'Precios, frescura y límites registrados por el contrato de préstamo.',
      fresh: 'Fresco',
      stale: 'Obsoleto',
      future: 'Fecha futura',
      missing: 'Faltante',
      noOnChainPrice: 'Sin precio en cadena',
      oracleSource: 'Oráculo',
      demoSource: 'Precio demo',
      updatedAgo: 'Actualizado {time}',
      justNow: 'hace un momento',
      staleWarning: 'Precio obsoleto (>1h): los nuevos préstamos y liquidaciones fallarán.',
      futureWarning: 'Marca temporal futura: el contrato rechaza marcas temporales posteriores al cierre del libro mayor.',
      bounds: 'Límites',
      min: 'Mín: {price}',
      max: 'Máx: {price}',
      noBounds: 'Sin límites establecidos',
      timeSourceLedger: 'Hora del libro mayor',
      timeSourceBrowser: 'Reloj del navegador',
      loading: 'Cargando precios de oráculo...',
    },
  },
};

function renderApp() {
  return render(
    <NextIntlClientProvider locale="es" messages={messages}>
      <MarketsApp />
    </NextIntlClientProvider>
  );
}

describe('MarketsApp locale rendering', () => {
  it('renders Spanish labels and formatted values', () => {
    renderApp();

    expect(screen.getByRole('heading', { name: 'Mercados' })).toBeInTheDocument();
    expect(screen.getAllByText('Cartera').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Activo')).toBeInTheDocument();
  }, 20_000);

  it('labels non-XLM markets as coming soon', () => {
    renderApp();

    expect(screen.getAllByText('Próximamente').length).toBeGreaterThan(0);
    expect(screen.getByText('XLM')).toBeInTheDocument();
  });

  it('falls back to the labelled demo ledger when no wallet is connected', () => {
    renderApp();

    expect(screen.getByText('Modo demo (sin cartera conectada)')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Operar' }));
    fireEvent.change(screen.getByLabelText('Cantidad en XLM'), { target: { value: '10' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar depositar' }));

    expect(screen.getByRole('status')).toHaveTextContent('registrado');
  }, 20_000);
});
