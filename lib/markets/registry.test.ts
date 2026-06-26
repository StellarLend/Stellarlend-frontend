import { describe, it, expect } from 'vitest';
import {
  getCollateralConfig,
  getCollateralFactor,
  getLiquidationThreshold,
  isAssetSymbol,
  type CollateralConfig,
} from './registry';

describe('getCollateralConfig', () => {
  it('returns config for XLM', () => {
    const config = getCollateralConfig('XLM');
    expect(config.collateralFactor).toBe(0.75);
    expect(config.liquidationThreshold).toBe(0.80);
  });

  it('returns config for USDC', () => {
    const config = getCollateralConfig('USDC');
    expect(config.collateralFactor).toBe(0.85);
    expect(config.liquidationThreshold).toBe(0.90);
  });

  it('returns config for BTC', () => {
    const config = getCollateralConfig('BTC');
    expect(config.collateralFactor).toBe(0.80);
    expect(config.liquidationThreshold).toBe(0.85);
  });

  it('returns config for ETH', () => {
    const config = getCollateralConfig('ETH');
    expect(config.collateralFactor).toBe(0.80);
    expect(config.liquidationThreshold).toBe(0.85);
  });
});

describe('getCollateralFactor', () => {
  it('returns collateral factor for each asset', () => {
    expect(getCollateralFactor('XLM')).toBe(0.75);
    expect(getCollateralFactor('USDC')).toBe(0.85);
    expect(getCollateralFactor('BTC')).toBe(0.80);
    expect(getCollateralFactor('ETH')).toBe(0.80);
  });
});

describe('getLiquidationThreshold', () => {
  it('returns liquidation threshold for each asset', () => {
    expect(getLiquidationThreshold('XLM')).toBe(0.80);
    expect(getLiquidationThreshold('USDC')).toBe(0.90);
    expect(getLiquidationThreshold('BTC')).toBe(0.85);
    expect(getLiquidationThreshold('ETH')).toBe(0.85);
  });
});

describe('isAssetSymbol', () => {
  it('returns true for valid asset symbols', () => {
    expect(isAssetSymbol('XLM')).toBe(true);
    expect(isAssetSymbol('USDC')).toBe(true);
    expect(isAssetSymbol('BTC')).toBe(true);
    expect(isAssetSymbol('ETH')).toBe(true);
  });

  it('returns false for invalid asset symbols', () => {
    expect(isAssetSymbol('SOL')).toBe(false);
    expect(isAssetSymbol('')).toBe(false);
    expect(isAssetSymbol('xlm')).toBe(false);
    expect(isAssetSymbol('DOGE')).toBe(false);
  });
});
