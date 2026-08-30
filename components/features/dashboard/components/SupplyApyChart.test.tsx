import React from 'react';
import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import SupplyApyChart from './SupplyApyChart';

const fetchMock = vi.fn();

vi.stubGlobal('fetch', fetchMock);

describe('SupplyApyChart', () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('shows a loading state while history is being fetched', () => {
    fetchMock.mockImplementation(() => new Promise(() => undefined));

    render(<SupplyApyChart />);

    expect(screen.getByRole('status', { name: /Loading trend data/i })).toBeInTheDocument();
  });

  it('shows an empty state when the history response has no snapshots', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        walletAddress: 'abc',
        snapshots: [],
        interval: '1d',
        bucketCount: 0,
      }),
    } as Response);

    render(<SupplyApyChart />);

    expect(await screen.findByText(/No trend history available/i)).toBeInTheDocument();
  });

  it('renders a single data point without breaking the chart', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        walletAddress: 'abc',
        snapshots: [
          {
            timestamp: 1_700_000_000_000,
            supplied: 1_200,
            borrowed: 300,
            effectiveSupplyApy: 4.2,
            effectiveBorrowApy: 6.1,
          },
        ],
        interval: '1d',
        bucketCount: 1,
      }),
    } as Response);

    render(<SupplyApyChart />);

    expect(await screen.findByRole('img', { name: /supply apy trend/i })).toBeInTheDocument();
    expect(
      await screen.findByText(/4\.20%/i, {
        selector: 'p',
      }),
    ).toBeInTheDocument();
  });

  it('includes a hidden summary for screen readers with current value and time range', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        walletAddress: 'abc',
        snapshots: [
          {
            timestamp: 1_700_000_000_000,
            supplied: 1_200,
            borrowed: 300,
            effectiveSupplyApy: 4.2,
            effectiveBorrowApy: 6.1,
          },
        ],
        interval: '1d',
        bucketCount: 1,
      }),
    } as Response);

    render(<SupplyApyChart />);

    expect(
      await screen.findByText(/Supply APY is 4\.20%.*unchanged.*as of/i, {
        hidden: true,
      }),
    ).toBeInTheDocument();
  });

  it('shows an error message when the request fails', async () => {
    fetchMock.mockRejectedValueOnce(new Error('failed'));

    render(<SupplyApyChart />);

    expect(await screen.findByText(/Trend data unavailable/i)).toBeInTheDocument();
  });
});
