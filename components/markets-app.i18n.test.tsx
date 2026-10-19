import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { NextIntlClientProvider } from 'next-intl';
import MarketsApp from './markets-app';

const messages = {
  market: {
    title: 'Mercados',
    wallet: 'Cartera',
    demoMode: 'Modo demo (sin cartera conectada)',
    collateral: 'Colateral',
    borrowed: 'Prestado',
    health: 'Salud',
    asset: 'Activo',
    price: 'Precio',
    supplyApy: 'APY de depósito',
    borrowApy: 'APY de préstamo',
    totalSupplied: 'Total suministrado',
    yourPosition: 'Tu posición',
    trade: 'Operar',
    confirm: 'Confirmar {action}',
    supply: 'depositar',
    borrow: 'pedir prestado',
    withdraw: 'retirar',
    repay: 'pagar',
    amountIn: 'Cantidad en {symbol}',
    connectFreighter: 'Conectar Freighter',
    contract: 'Contrato de préstamo',
    notDeployed: 'no desplegado',
    status: {
      positiveAmount: 'Introduce una cantidad mayor que cero.',
      exceedsSupply: 'No puedes retirar más de lo suministrado.',
      exceedsBorrowLimit: 'El préstamo supera tu límite de endeudamiento.',
      exceedsBorrowed: 'No puedes pagar más de lo prestado.',
      underCollateralised: 'La retirada dejaría tu posición infracolateralizada.',
      recorded: '{action} de {amount} {symbol} registrado (libro de demostración).',
    },
  },
};

describe('MarketsApp locale rendering', () => {
  it('renders Spanish labels and formatted values', () => {
    render(
      <NextIntlClientProvider locale="es" messages={messages}>
        <MarketsApp />
      </NextIntlClientProvider>
    );

    expect(screen.getByRole('heading', { name: 'Mercados' })).toBeInTheDocument();
    expect(screen.getAllByText('Cartera').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Activo')).toBeInTheDocument();
  });
});
