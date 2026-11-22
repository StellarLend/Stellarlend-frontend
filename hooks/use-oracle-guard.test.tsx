import React from "react";
import { render, renderHook, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import enMessages from "@/messages/en.json";
import esMessages from "@/messages/es.json";
import * as oracleModule from "@/lib/oracle";
import type { OracleAssetPrice } from "@/lib/oracle";
import {
  evaluateOracleGuard,
  useOracleGuard,
} from "./use-oracle-guard";
import MarketsApp from "@/components/markets-app";

const ASSET_A = "CA3D5KRYM6CB7OWQ6TWYRR3Z4EK7HX3ZNV6HG7L4CHOHP7S2YYKZ5K7K";
const ASSET_B = "CB3D5KRYM6CB7OWQ6TWYRR3Z4EK7HX3ZNV6HG7L4CHOHP7S2YYKZ5K7K";

function makePrice(overrides: Partial<OracleAssetPrice> = {}): OracleAssetPrice {
  return {
    assetId: ASSET_A,
    symbol: "XLM",
    price: 1_200_000n,
    priceNumber: 0.12,
    timestamp: 10_000n,
    ageSeconds: 10,
    status: "fresh",
    bounds: { min: 500_000n, max: 5_000_000n },
    source: "oracle",
    ...overrides,
  };
}

function createTestWrapper() {
  const client = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>
      <NextIntlClientProvider locale="en" messages={enMessages}>
        {children}
      </NextIntlClientProvider>
    </QueryClientProvider>
  );
  return { client, Wrapper };
}

describe("evaluateOracleGuard (pure)", () => {
  const now = 10_010;

  it("allows all modes when all prices are fresh and within bounds", () => {
    const prices = { [ASSET_A]: makePrice() };
    for (const mode of ["supply", "borrow", "withdraw", "repay"] as const) {
      const res = evaluateOracleGuard(prices, now, mode);
      expect(res.status).toBe("fresh");
      expect(res.reason).toBeNull();
      expect(res.blocked).toBe(false);
      expect(res.warning).toBe(false);
      expect(res.byAsset[ASSET_A]).toEqual({ status: "fresh", reason: null });
    }
  });

  it("blocks borrow and withdraw when price is stale, warns on supply and repay", () => {
    const stalePrice = makePrice({ timestamp: BigInt(now - 3601) });
    const prices = { [ASSET_A]: stalePrice };

    const borrow = evaluateOracleGuard(prices, now, "borrow");
    expect(borrow.status).toBe("stale");
    expect(borrow.reason).toBe("stale");
    expect(borrow.blocked).toBe(true);
    expect(borrow.warning).toBe(false);

    const withdraw = evaluateOracleGuard(prices, now, "withdraw");
    expect(withdraw.blocked).toBe(true);
    expect(withdraw.reason).toBe("stale");

    const supply = evaluateOracleGuard(prices, now, "supply");
    expect(supply.blocked).toBe(false);
    expect(supply.warning).toBe(true);
    expect(supply.reason).toBe("stale");

    const repay = evaluateOracleGuard(prices, now, "repay");
    expect(repay.blocked).toBe(false);
    expect(repay.warning).toBe(true);
    expect(repay.reason).toBe("stale");
  });

  it("blocks borrow and withdraw when price timestamp is in the future", () => {
    const futurePrice = makePrice({ timestamp: BigInt(now + 60) });
    const res = evaluateOracleGuard({ [ASSET_A]: futurePrice }, now, "borrow");
    expect(res.status).toBe("future");
    expect(res.reason).toBe("future");
    expect(res.blocked).toBe(true);
  });

  it("blocks borrow and withdraw when price is missing", () => {
    const missingPrice = makePrice({ price: null, priceNumber: null, timestamp: null, status: "missing" });
    const borrow = evaluateOracleGuard({ [ASSET_A]: missingPrice }, now, "borrow");
    expect(borrow.status).toBe("missing");
    expect(borrow.reason).toBe("missing");
    expect(borrow.blocked).toBe(true);

    const repay = evaluateOracleGuard({ [ASSET_A]: missingPrice }, now, "repay");
    expect(repay.blocked).toBe(false);
    expect(repay.warning).toBe(true);
    expect(repay.reason).toBe("missing");
  });

  it("blocks borrow and withdraw when price is outside PriceBounds (below min or above max)", () => {
    const belowMin = makePrice({ price: 400_000n, bounds: { min: 500_000n, max: 5_000_000n } });
    const resLow = evaluateOracleGuard({ [ASSET_A]: belowMin }, now, "withdraw");
    expect(resLow.status).toBe("out_of_bounds");
    expect(resLow.reason).toBe("outOfBounds");
    expect(resLow.blocked).toBe(true);

    const aboveMax = makePrice({ price: 6_000_000n, bounds: { min: 500_000n, max: 5_000_000n } });
    const resHigh = evaluateOracleGuard({ [ASSET_A]: aboveMax }, now, "borrow");
    expect(resHigh.status).toBe("out_of_bounds");
    expect(resHigh.reason).toBe("outOfBounds");
    expect(resHigh.blocked).toBe(true);
  });

  it("detects unhealthy collateral asset even when borrowed asset is fresh", () => {
    const prices = {
      [ASSET_A]: makePrice({ assetId: ASSET_A }),
      [ASSET_B]: makePrice({ assetId: ASSET_B, timestamp: BigInt(now - 5000) }),
    };
    const res = evaluateOracleGuard(prices, now, "borrow");
    expect(res.blocked).toBe(true);
    expect(res.status).toBe("stale");
    expect(res.affectedAssetId).toBe(ASSET_B);
  });

  it("honors NEXT_PUBLIC_ORACLE_MAX_AGE_SECONDS override", () => {
    const prev = process.env.NEXT_PUBLIC_ORACLE_MAX_AGE_SECONDS;
    process.env.NEXT_PUBLIC_ORACLE_MAX_AGE_SECONDS = "7200";
    try {
      // 4000s old: stale under default 3600s, fresh under 7200s override
      const price = makePrice({ timestamp: BigInt(now - 4000) });
      const res = evaluateOracleGuard({ [ASSET_A]: price }, now, "borrow");
      expect(res.status).toBe("fresh");
      expect(res.blocked).toBe(false);
    } finally {
      if (prev === undefined) {
        delete process.env.NEXT_PUBLIC_ORACLE_MAX_AGE_SECONDS;
      } else {
        process.env.NEXT_PUBLIC_ORACLE_MAX_AGE_SECONDS = prev;
      }
    }
  });

  it("has distinct en and es message keys for every guard reason", () => {
    const keys = ["stale", "future", "missing", "outOfBounds"] as const;
    const enValues = new Set(keys.map((k) => enMessages.market.oracle.guard[k]));
    const esValues = new Set(keys.map((k) => esMessages.market.oracle.guard[k]));
    expect(enValues.size).toBe(4);
    expect(esValues.size).toBe(4);
  });
});

describe("useOracleGuard hook", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("recomputes guard state when prices refresh without remount", async () => {
    const now = 20_000;
    const fetchSpy = vi
      .spyOn(oracleModule, "fetchOracleAssetPrices")
      .mockResolvedValueOnce({
        prices: { [ASSET_A]: makePrice({ timestamp: BigInt(now - 4000) }) },
        timeSource: "ledger",
        referenceTimeSeconds: now,
      })
      .mockResolvedValueOnce({
        prices: { [ASSET_A]: makePrice({ timestamp: BigInt(now - 5) }) },
        timeSource: "ledger",
        referenceTimeSeconds: now,
      });

    const { Wrapper } = createTestWrapper();
    const { result } = renderHook(() => useOracleGuard(), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.byAsset[ASSET_A]?.status).toBe("stale");
    });
    expect(result.current.evaluate("borrow").blocked).toBe(true);

    await act(async () => {
      await result.current.refetch();
    });

    await waitFor(() => {
      expect(result.current.byAsset[ASSET_A]?.status).toBe("fresh");
    });
    expect(result.current.evaluate("borrow").blocked).toBe(false);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });
});

describe("MarketsApp oracle guard UI", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("blocks borrow when price stale", async () => {
    const now = 30_000;
    vi.spyOn(oracleModule, "fetchOracleAssetPrices").mockResolvedValue({
      prices: { [ASSET_A]: makePrice({ timestamp: BigInt(now - 5000) }) },
      timeSource: "ledger",
      referenceTimeSeconds: now,
    });

    const { Wrapper } = createTestWrapper();
    render(
      <Wrapper>
        <MarketsApp />
      </Wrapper>
    );

    const tradeButtons = screen.getAllByRole("button", { name: /Trade/i });
    fireEvent.click(tradeButtons[0]);

    const borrowTab = screen.getAllByRole("tab", { name: "Borrow" })[0];
    fireEvent.click(borrowTab);

    await waitFor(() => {
      const confirmBtn = screen.getAllByRole("button", { name: "Confirm Borrow" })[0];
      expect(confirmBtn).toBeDisabled();
      expect(confirmBtn).toHaveAttribute("aria-describedby", "oracle-guard-reason");
    });

    const reasonEl = document.getElementById("oracle-guard-reason");
    expect(reasonEl).toHaveTextContent(enMessages.market.oracle.guard.stale);
    const link = screen.getAllByRole("link", { name: enMessages.market.oracle.guard.viewOracle })[0];
    expect(link).toHaveAttribute("href", "#oracle-panel");
  });

  it("allows repay with warning when price missing", async () => {
    const now = 30_000;
    vi.spyOn(oracleModule, "fetchOracleAssetPrices").mockResolvedValue({
      prices: {
        [ASSET_A]: makePrice({
          price: null,
          priceNumber: null,
          timestamp: null,
          status: "missing",
        }),
      },
      timeSource: "ledger",
      referenceTimeSeconds: now,
    });

    const { Wrapper } = createTestWrapper();
    render(
      <Wrapper>
        <MarketsApp />
      </Wrapper>
    );

    const tradeButtons = screen.getAllByRole("button", { name: /Trade/i });
    fireEvent.click(tradeButtons[0]);

    const repayTab = screen.getAllByRole("tab", { name: "Repay" })[0];
    fireEvent.click(repayTab);

    await waitFor(() => {
      const reasonEl = document.getElementById("oracle-guard-reason");
      expect(reasonEl).toBeInTheDocument();
      expect(reasonEl).toHaveTextContent(enMessages.market.oracle.guard.missing);
    });

    const confirmBtn = screen.getAllByRole("button", { name: "Confirm Repay" })[0];
    expect(confirmBtn).not.toBeDisabled();
    expect(confirmBtn).toHaveAttribute("aria-describedby", "oracle-guard-reason");
  });

  it("blocks withdraw when price out of bounds", async () => {
    const now = 30_000;
    vi.spyOn(oracleModule, "fetchOracleAssetPrices").mockResolvedValue({
      prices: {
        [ASSET_A]: makePrice({
          price: 9_000_000n,
          timestamp: BigInt(now - 10),
          bounds: { min: 500_000n, max: 5_000_000n },
        }),
      },
      timeSource: "ledger",
      referenceTimeSeconds: now,
    });

    const { Wrapper } = createTestWrapper();
    render(
      <Wrapper>
        <MarketsApp />
      </Wrapper>
    );

    const tradeButtons = screen.getAllByRole("button", { name: /Trade/i });
    fireEvent.click(tradeButtons[0]);

    const withdrawTab = screen.getAllByRole("tab", { name: "Withdraw" })[0];
    fireEvent.click(withdrawTab);

    await waitFor(() => {
      const confirmBtn = screen.getAllByRole("button", { name: "Confirm Withdraw" })[0];
      expect(confirmBtn).toBeDisabled();
      expect(confirmBtn).toHaveAttribute("aria-describedby", "oracle-guard-reason");
    });

    const reasonEl = document.getElementById("oracle-guard-reason");
    expect(reasonEl).toHaveTextContent(enMessages.market.oracle.guard.outOfBounds);
  });
});
