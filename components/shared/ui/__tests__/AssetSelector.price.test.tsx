import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AssetSelector from "../AssetSelector";
import { ASSETS } from "@/lib/assets";
import { resetPricesCache } from "@/hooks/usePrices";
import { PRICE_CACHE_CONFIG } from "@/lib/prices/constants";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockPrices = {
  XLM: 0.12,
  USDC: 1,
  BTC: 65000,
  ETH: 3500,
};

function mockPriceFetch(
  implementation?: () => Promise<{ ok: boolean; json: () => Promise<unknown> }>,
) {
  vi.mocked(global.fetch).mockImplementation(
    implementation ??
      (async () => ({
        ok: true,
        json: async () => ({
          prices: mockPrices,
          timestamp: new Date().toISOString(),
          source: "test",
        }),
      })),
  );
}

describe("AssetSelector price tooltip", () => {
  beforeEach(() => {
    resetPricesCache();
    vi.stubGlobal("fetch", vi.fn());
    mockPriceFetch();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("shows formatted price in tooltip on hover", async () => {
    render(<AssetSelector assets={ASSETS} value="XLM" onChange={() => {}} />);

    await userEvent.click(screen.getByRole("button", { name: /Asset selector/i }));

    const xlmOption = screen.getByRole("option", { name: /XLM/i });

    await waitFor(() => {
      expect(fetch).toHaveBeenCalled();
    });

    fireEvent.mouseEnter(xlmOption);

    expect(await screen.findByRole("tooltip")).toHaveTextContent("$0.12");
  });

  it("shows price unavailable when /api/prices fails", async () => {
    mockPriceFetch(async () => {
      throw new Error("Network error");
    });

    render(<AssetSelector assets={ASSETS} value="XLM" onChange={() => {}} />);

    await userEvent.click(screen.getByRole("button", { name: /Asset selector/i }));

    const usdcOption = screen.getByRole("option", { name: /USDC/i });

    await waitFor(() => {
      expect(fetch).toHaveBeenCalled();
    });

    fireEvent.mouseEnter(usdcOption);

    expect(await screen.findByRole("tooltip")).toHaveTextContent(
      "Price unavailable",
    );
  });

  it("shows refreshed price after stale cache is refetched", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));

    let callCount = 0;
    mockPriceFetch(async () => {
      callCount += 1;
      return {
        ok: true,
        json: async () => ({
          prices: {
            ...mockPrices,
            XLM: callCount === 1 ? 0.12 : 0.2,
          },
          timestamp: new Date().toISOString(),
          source: "test",
        }),
      };
    });

    render(<AssetSelector assets={ASSETS} value="XLM" onChange={() => {}} />);

    await userEvent.click(screen.getByRole("button", { name: /Asset selector/i }));

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));

    const xlmOption = screen.getByRole("option", { name: /XLM/i });
    fireEvent.mouseEnter(xlmOption);
    expect(await screen.findByRole("tooltip")).toHaveTextContent("$0.12");

    fireEvent.mouseLeave(xlmOption);

    vi.setSystemTime(
      new Date(Date.now() + PRICE_CACHE_CONFIG.ttl + 1),
    );

    await act(async () => {
      await userEvent.click(screen.getByRole("button", { name: /Asset selector/i }));
      await userEvent.click(screen.getByRole("button", { name: /Asset selector/i }));
    });

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));

    fireEvent.mouseEnter(xlmOption);
    expect(await screen.findByRole("tooltip")).toHaveTextContent("$0.20");
  });

  it("shows tooltip on keyboard focus", async () => {
    render(<AssetSelector assets={ASSETS} value="XLM" onChange={() => {}} />);

    await userEvent.click(screen.getByRole("button", { name: /Asset selector/i }));

    const btcOption = screen.getByRole("option", { name: /BTC/i });

    await waitFor(() => {
      expect(fetch).toHaveBeenCalled();
    });

    act(() => {
      btcOption.focus();
    });

    expect(await screen.findByRole("tooltip")).toHaveTextContent("$65,000.00");
  });

  it("does not block asset selection while prices are loading", async () => {
    const onChange = vi.fn();
    let resolveFetch: (value: Response) => void = () => {};

    vi.mocked(global.fetch).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveFetch = resolve;
        }),
    );

    render(<AssetSelector assets={ASSETS} value="XLM" onChange={onChange} />);

    await userEvent.click(screen.getByRole("button", { name: /Asset selector/i }));

    const ethOption = screen.getByRole("option", { name: /ETH/i });
    await userEvent.click(ethOption);

    expect(onChange).toHaveBeenCalledWith("ETH");
    expect(screen.queryByRole("listbox")).toBeNull();

    resolveFetch({
      ok: true,
      json: async () => ({
        prices: mockPrices,
        timestamp: new Date().toISOString(),
        source: "test",
      }),
    } as Response);
  });

  it("handles rapid asset switching without duplicate fetches", async () => {
    render(<AssetSelector assets={ASSETS} value="XLM" onChange={() => {}} />);

    const trigger = screen.getByRole("button", { name: /Asset selector/i });

    await userEvent.click(trigger);
    await userEvent.click(trigger);
    await userEvent.click(trigger);

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledTimes(1);
    });
  });
});
