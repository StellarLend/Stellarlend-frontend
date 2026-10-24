import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import LiquidateComponent from './liquidate';
import * as liquidationLib from '@/lib/liquidation';
import * as txLib from '@/lib/tx';
import * as walletHook from '@/hooks/useWalletConnection';

// Mock the wallet connection hook
vi.mock('@/hooks/useWalletConnection', () => ({
  useWalletConnection: vi.fn(),
}));

// Mock the liquidation library
vi.mock('@/lib/liquidation', () => ({
  getLiquidationParams: vi.fn(),
  getBorrowerPosition: vi.fn(),
  isPositionLiquidatable: vi.fn(),
  previewLiquidation: vi.fn(),
}));

// Mock the transaction library
vi.mock('@/lib/tx', () => ({
  executeLiquidation: vi.fn(),
  parseContractError: vi.fn(),
}));

// Mock validation
vi.mock('@/lib/validation/stellar', () => ({
  isAccountId: vi.fn((addr: string) => addr.startsWith('G') && addr.length === 56),
}));

describe('LiquidateComponent', () => {
  const mockLiquidatorAddress = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF';
  const mockBorrowerAddress = 'GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB';

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(walletHook.useWalletConnection).mockReturnValue({
      address: mockLiquidatorAddress,
      walletAddress: mockLiquidatorAddress,
      network: 'TESTNET',
      status: 'connected',
      error: null,
      isConnected: true,
      isLoading: false,
      connect: vi.fn(),
      disconnect: vi.fn(),
    });
  });

  it('renders the liquidation page with header', () => {
    render(<LiquidateComponent />);

    expect(screen.getByText('Liquidate Positions')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Inspect unhealthy borrower positions and execute liquidations to maintain protocol solvency.',
      ),
    ).toBeInTheDocument();
  });

  it('shows borrower address input', () => {
    render(<LiquidateComponent />);

    expect(screen.getByPlaceholderText('G...')).toBeInTheDocument();
    expect(screen.getByText('Inspect')).toBeInTheDocument();
  });

  it('validates invalid Stellar address', async () => {
    render(<LiquidateComponent />);

    const input = screen.getByPlaceholderText('G...');
    const button = screen.getByText('Inspect');

    fireEvent.change(input, { target: { value: 'invalid' } });
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText(/Please enter a valid Stellar address/)).toBeInTheDocument();
    });
  });

  it('loads position for valid address', async () => {
    const mockParams = {
      liquidationThresholdBps: 8500n,
      closeFactorBps: 5000n,
      liquidationIncentiveBps: 500n,
      gracePeriodSeconds: 3600,
    };

    const mockPosition = {
      collateralAmount: 2000n,
      debtAmount: 1000n,
      healthFactor: 8000n,
      lastUpdateTimestamp: Date.now() / 1000 - 4000,
    };

    vi.mocked(liquidationLib.getLiquidationParams).mockResolvedValue(mockParams);
    vi.mocked(liquidationLib.getBorrowerPosition).mockResolvedValue(mockPosition);
    vi.mocked(liquidationLib.isPositionLiquidatable).mockReturnValue({
      liquidatable: true,
    });

    render(<LiquidateComponent />);

    const input = screen.getByPlaceholderText('G...');
    const button = screen.getByText('Inspect');

    fireEvent.change(input, { target: { value: mockBorrowerAddress } });
    fireEvent.click(button);

    await waitFor(() => {
      expect(liquidationLib.getLiquidationParams).toHaveBeenCalled();
      expect(liquidationLib.getBorrowerPosition).toHaveBeenCalledWith(mockBorrowerAddress);
    });

    await waitFor(() => {
      expect(screen.getByText('Position Details')).toBeInTheDocument();
      expect(screen.getByText('2000')).toBeInTheDocument(); // collateral
      expect(screen.getByText('1000')).toBeInTheDocument(); // debt
    });
  });

  it('shows healthy status for healthy position', async () => {
    const mockParams = {
      liquidationThresholdBps: 8500n,
      closeFactorBps: 5000n,
      liquidationIncentiveBps: 500n,
      gracePeriodSeconds: 3600,
    };

    const mockPosition = {
      collateralAmount: 2000n,
      debtAmount: 1000n,
      healthFactor: 15000n, // Healthy (> 1.0)
      lastUpdateTimestamp: Date.now() / 1000,
    };

    vi.mocked(liquidationLib.getLiquidationParams).mockResolvedValue(mockParams);
    vi.mocked(liquidationLib.getBorrowerPosition).mockResolvedValue(mockPosition);
    vi.mocked(liquidationLib.isPositionLiquidatable).mockReturnValue({
      liquidatable: false,
      reason: 'Position is healthy',
    });

    render(<LiquidateComponent />);

    const input = screen.getByPlaceholderText('G...');
    const button = screen.getByText('Inspect');

    fireEvent.change(input, { target: { value: mockBorrowerAddress } });
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText('Healthy')).toBeInTheDocument();
    });
  });

  it('shows liquidatable status for unhealthy position', async () => {
    const mockParams = {
      liquidationThresholdBps: 8500n,
      closeFactorBps: 5000n,
      liquidationIncentiveBps: 500n,
      gracePeriodSeconds: 3600,
    };

    const mockPosition = {
      collateralAmount: 2000n,
      debtAmount: 1000n,
      healthFactor: 8000n, // Unhealthy (< 1.0)
      lastUpdateTimestamp: Date.now() / 1000 - 4000,
    };

    vi.mocked(liquidationLib.getLiquidationParams).mockResolvedValue(mockParams);
    vi.mocked(liquidationLib.getBorrowerPosition).mockResolvedValue(mockPosition);
    vi.mocked(liquidationLib.isPositionLiquidatable).mockReturnValue({
      liquidatable: true,
    });

    render(<LiquidateComponent />);

    const input = screen.getByPlaceholderText('G...');
    const button = screen.getByText('Inspect');

    fireEvent.change(input, { target: { value: mockBorrowerAddress } });
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText('Liquidatable')).toBeInTheDocument();
    });
  });

  it('shows self-liquidation warning when borrower is liquidator', async () => {
    const mockParams = {
      liquidationThresholdBps: 8500n,
      closeFactorBps: 5000n,
      liquidationIncentiveBps: 500n,
      gracePeriodSeconds: 3600,
    };

    const mockPosition = {
      collateralAmount: 2000n,
      debtAmount: 1000n,
      healthFactor: 8000n,
      lastUpdateTimestamp: Date.now() / 1000 - 4000,
    };

    vi.mocked(liquidationLib.getLiquidationParams).mockResolvedValue(mockParams);
    vi.mocked(liquidationLib.getBorrowerPosition).mockResolvedValue(mockPosition);
    vi.mocked(liquidationLib.isPositionLiquidatable).mockReturnValue({
      liquidatable: true,
    });

    render(<LiquidateComponent />);

    const input = screen.getByPlaceholderText('G...');
    const button = screen.getByText('Inspect');

    // Enter liquidator's own address
    fireEvent.change(input, { target: { value: mockLiquidatorAddress } });
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText(/You cannot liquidate your own position/)).toBeInTheDocument();
    });
  });

  it('calculates and shows liquidation preview', async () => {
    const mockParams = {
      liquidationThresholdBps: 8500n,
      closeFactorBps: 5000n,
      liquidationIncentiveBps: 500n,
      gracePeriodSeconds: 3600,
    };

    const mockPosition = {
      collateralAmount: 2000n,
      debtAmount: 1000n,
      healthFactor: 8000n,
      lastUpdateTimestamp: Date.now() / 1000 - 4000,
    };

    const mockPreview = {
      actualRepay: 500n,
      seizedEstimate: 525n,
    };

    vi.mocked(liquidationLib.getLiquidationParams).mockResolvedValue(mockParams);
    vi.mocked(liquidationLib.getBorrowerPosition).mockResolvedValue(mockPosition);
    vi.mocked(liquidationLib.isPositionLiquidatable).mockReturnValue({
      liquidatable: true,
    });
    vi.mocked(liquidationLib.previewLiquidation).mockReturnValue(mockPreview);

    render(<LiquidateComponent />);

    const input = screen.getByPlaceholderText('G...');
    const inspectButton = screen.getByText('Inspect');

    fireEvent.change(input, { target: { value: mockBorrowerAddress } });
    fireEvent.click(inspectButton);

    await waitFor(() => {
      expect(screen.getByText('Position Details')).toBeInTheDocument();
    });

    const amountInput = screen.getByPlaceholderText('Enter amount');
    fireEvent.change(amountInput, { target: { value: '500' } });

    await waitFor(() => {
      expect(liquidationLib.previewLiquidation).toHaveBeenCalled();
      expect(screen.getByText('Liquidation Preview')).toBeInTheDocument();
      expect(screen.getByText('500')).toBeInTheDocument(); // actual repay
      expect(screen.getByText('525')).toBeInTheDocument(); // seized
    });
  });

  it('submits liquidation successfully', async () => {
    const mockParams = {
      liquidationThresholdBps: 8500n,
      closeFactorBps: 5000n,
      liquidationIncentiveBps: 500n,
      gracePeriodSeconds: 3600,
    };

    const mockPosition = {
      collateralAmount: 2000n,
      debtAmount: 1000n,
      healthFactor: 8000n,
      lastUpdateTimestamp: Date.now() / 1000 - 4000,
    };

    const mockPreview = {
      actualRepay: 500n,
      seizedEstimate: 525n,
    };

    const mockTxResult = {
      hash: 'test-tx-hash-123',
      status: 'success' as const,
    };

    vi.mocked(liquidationLib.getLiquidationParams).mockResolvedValue(mockParams);
    vi.mocked(liquidationLib.getBorrowerPosition).mockResolvedValue(mockPosition);
    vi.mocked(liquidationLib.isPositionLiquidatable).mockReturnValue({
      liquidatable: true,
    });
    vi.mocked(liquidationLib.previewLiquidation).mockReturnValue(mockPreview);
    vi.mocked(txLib.executeLiquidation).mockResolvedValue(mockTxResult);

    render(<LiquidateComponent />);

    const input = screen.getByPlaceholderText('G...');
    const inspectButton = screen.getByText('Inspect');

    fireEvent.change(input, { target: { value: mockBorrowerAddress } });
    fireEvent.click(inspectButton);

    await waitFor(() => {
      expect(screen.getByText('Position Details')).toBeInTheDocument();
    });

    const amountInput = screen.getByPlaceholderText('Enter amount');
    fireEvent.change(amountInput, { target: { value: '500' } });

    await waitFor(() => {
      expect(screen.getByText('Liquidation Preview')).toBeInTheDocument();
    });

    const submitButton = screen.getByText('Execute Liquidation');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(txLib.executeLiquidation).toHaveBeenCalled();
      expect(screen.getByText('Liquidation submitted')).toBeInTheDocument();
      expect(screen.getByText('test-tx-hash-123')).toBeInTheDocument();
    });
  });

  it('disables submit when wallet not connected', async () => {
    vi.mocked(walletHook.useWalletConnection).mockReturnValue({
      address: null,
      walletAddress: null,
      network: 'TESTNET',
      status: 'disconnected',
      error: null,
      isConnected: false,
      isLoading: false,
      connect: vi.fn(),
      disconnect: vi.fn(),
    });

    const mockParams = {
      liquidationThresholdBps: 8500n,
      closeFactorBps: 5000n,
      liquidationIncentiveBps: 500n,
      gracePeriodSeconds: 3600,
    };

    const mockPosition = {
      collateralAmount: 2000n,
      debtAmount: 1000n,
      healthFactor: 8000n,
      lastUpdateTimestamp: Date.now() / 1000 - 4000,
    };

    vi.mocked(liquidationLib.getLiquidationParams).mockResolvedValue(mockParams);
    vi.mocked(liquidationLib.getBorrowerPosition).mockResolvedValue(mockPosition);
    vi.mocked(liquidationLib.isPositionLiquidatable).mockReturnValue({
      liquidatable: true,
    });

    render(<LiquidateComponent />);

    const input = screen.getByPlaceholderText('G...');
    const button = screen.getByText('Inspect');

    fireEvent.change(input, { target: { value: mockBorrowerAddress } });
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText('Position Details')).toBeInTheDocument();
    });

    const amountInput = screen.getByPlaceholderText('Enter amount');
    fireEvent.change(amountInput, { target: { value: '500' } });

    await waitFor(() => {
      const submitButton = screen.getByText('Connect wallet to liquidate');
      expect(submitButton).toBeDisabled();
    });
  });
});
