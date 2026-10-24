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
    subtitle: 'Aporta para ganar, pide prestado contra colateral.',
    nA: 'n/a',
    resetDemo: 'Restablecer datos de demostración',
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

describe('MarketsApp locale rendering', () => {
  it('renders Spanish labels and formatted values', () => {
    render(
      <NextIntlClientProvider locale="es" messages={messages}>
        <MarketsApp />
      </NextIntlClientProvider>
    );

    expect(screen.getByRole('heading', { name: 'Mercados' })).toBeInTheDocument();
    expect(screen.getByText('Cartera')).toBeInTheDocument();
    expect(screen.getByText('Activo')).toBeInTheDocument();
  });
});
