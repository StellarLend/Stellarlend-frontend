import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { nativeToScVal } from "@stellar/stellar-sdk";

const mocks = vi.hoisted(() => ({
  lendingId: "CC4A6A46O2KQA7KEMOFK3TQ4YRSLCJ4ZP26SQWXIKNF4DTEX3BOL2HF6",
  simulateRead: vi.fn(),
}));

vi.mock("@/lib/config", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/config")>();
  return {
    ...actual,
    config: {
      ...actual.config,
      get lendingId() {
        return mocks.lendingId;
      },
      rpc: "https://soroban-testnet.stellar.org",
      networkPassphrase: "Test SDF Network ; September 2015",
    },
  };
});

vi.mock("@/lib/soroban-read", () => ({
  simulateRead: mocks.simulateRead,
}));

import { ContractNotConfiguredError } from "@/lib/api/errors";
import {
  decodeBorrowerPosition,
  decodeLiquidationParams,
  getBorrowerPosition,
  getLiquidationParams,
  resetLiquidationParamsCache,
} from "./liquidation";

const VALID_CONTRACT_ID = "CC4A6A46O2KQA7KEMOFK3TQ4YRSLCJ4ZP26SQWXIKNF4DTEX3BOL2HF6";
const BORROWER = "GBS6O6RWCY7NYVC5KL3YBPPSLXWLSV2OP4KNXJNKWCBWLMJNL5IN3NE6";

const i128 = (value: bigint | number) => nativeToScVal(value, { type: "i128" });
const u64 = (value: bigint | number) => nativeToScVal(value, { type: "u64" });

function positionScVal(
  fields: Record<string, unknown> = {},
): ReturnType<typeof nativeToScVal> {
  return nativeToScVal(
    { collateral: 2_000_000n, debt: 1_000_000n, health_factor: 8_000n, ...fields },
    {
      type: {
        collateral: [null, "i128"],
        debt: [null, "i128"],
        health_factor: [null, "i128"],
      },
    },
  );
}

function liquidationParamsScVals(overrides: Record<string, unknown> = {}) {
  return {
    liquidationThresholdBps: i128(8_500n),
    closeFactorBps: i128(5_000n),
    liquidationIncentiveBps: i128(500n),
    gracePeriodSeconds: u64(3_600n),
    ...overrides,
  };
}

function mockLiquidationReads(overrides: Record<string, unknown> = {}) {
  const values: Record<string, unknown> = {
    get_liquidation_threshold_bps: 8_500n,
    get_close_factor_bps: 5_000n,
    get_liquidation_incentive_bps: 500n,
    get_liquidation_grace_period: 3_600n,
    ...overrides,
  };
  mocks.simulateRead.mockImplementation(
    async ({ method }: { method: string }) => ({
      scVal:
        method === "get_liquidation_grace_period"
          ? u64(values[method] as bigint)
          : i128(values[method] as bigint),
      native: values[method],
      latestLedger: 1,
    }),
  );
}

describe("lib/liquidation readers", () => {
  beforeEach(() => {
    resetLiquidationParamsCache();
    mocks.lendingId = VALID_CONTRACT_ID;
    mocks.simulateRead.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("decodes liquidation bps fields as bigint and the grace period as number", async () => {
    mockLiquidationReads();

    const params = await getLiquidationParams();

    expect(params).toEqual({
      liquidationThresholdBps: 8_500n,
      closeFactorBps: 5_000n,
      liquidationIncentiveBps: 500n,
      gracePeriodSeconds: 3_600,
    });
    expect(typeof params.liquidationThresholdBps).toBe("bigint");
    expect(typeof params.closeFactorBps).toBe("bigint");
    expect(typeof params.liquidationIncentiveBps).toBe("bigint");
    expect(typeof params.gracePeriodSeconds).toBe("number");
    expect(mocks.simulateRead).toHaveBeenCalledTimes(4);
  });

  it("decodes a borrower position and its on-chain grace timestamp", async () => {
    mocks.simulateRead.mockImplementation(async ({ method }: { method: string }) =>
      method === "get_position"
        ? { scVal: positionScVal(), native: null, latestLedger: 1 }
        : { scVal: u64(1_700_000_000n), native: 1_700_000_000n, latestLedger: 1 },
    );

    const position = await getBorrowerPosition(BORROWER);

    expect(position).toEqual({
      collateralAmount: 2_000_000n,
      debtAmount: 1_000_000n,
      healthFactor: 8_000n,
      lastUpdateTimestamp: 1_700_000_000,
    });
  });

  it("only uses number for gracePeriodSeconds and lastUpdateTimestamp", () => {
    const params = decodeLiquidationParams(liquidationParamsScVals());
    expect(typeof params.liquidationThresholdBps).toBe("bigint");
    expect(typeof params.closeFactorBps).toBe("bigint");
    expect(typeof params.liquidationIncentiveBps).toBe("bigint");
    expect(typeof params.gracePeriodSeconds).toBe("number");

    const position = decodeBorrowerPosition(positionScVal(), u64(1_700_000_000n));
    expect(typeof position.collateralAmount).toBe("bigint");
    expect(typeof position.debtAmount).toBe("bigint");
    expect(typeof position.healthFactor).toBe("bigint");
    expect(typeof position.lastUpdateTimestamp).toBe("number");
  });

  it("throws ContractNotConfiguredError for getBorrowerPosition without a lending id", async () => {
    mocks.lendingId = "";

    await expect(getBorrowerPosition(BORROWER)).rejects.toBeInstanceOf(
      ContractNotConfiguredError,
    );
    expect(mocks.simulateRead).not.toHaveBeenCalled();
  });

  it("throws ContractNotConfiguredError for getLiquidationParams without a lending id", async () => {
    mocks.lendingId = "";

    await expect(getLiquidationParams()).rejects.toBeInstanceOf(
      ContractNotConfiguredError,
    );
    expect(mocks.simulateRead).not.toHaveBeenCalled();
  });

  it("throws ContractNotConfiguredError for an invalid contract id", async () => {
    mocks.lendingId = "not-a-contract";

    await expect(getLiquidationParams()).rejects.toBeInstanceOf(
      ContractNotConfiguredError,
    );
    await expect(getBorrowerPosition(BORROWER)).rejects.toBeInstanceOf(
      ContractNotConfiguredError,
    );
    expect(mocks.simulateRead).not.toHaveBeenCalled();
  });

  it("rejects a position without a health factor and names the missing field", () => {
    const missingHealthFactor = nativeToScVal(
      { collateral: 2_000_000n, debt: 1_000_000n },
      { type: { collateral: [null, "i128"], debt: [null, "i128"] } },
    );

    expect(() => decodeBorrowerPosition(missingHealthFactor)).toThrow(/health_factor/);
  });

  it("names the malformed field when an ScVal cannot be decoded", () => {
    expect(() =>
      decodeLiquidationParams(
        liquidationParamsScVals({ closeFactorBps: nativeToScVal("not-a-number") }),
      ),
    ).toThrow(/closeFactorBps/);

    expect(() =>
      decodeLiquidationParams(
        liquidationParamsScVals({ gracePeriodSeconds: i128(-1n) }),
      ),
    ).toThrow(/gracePeriodSeconds/);
  });

  it("caches params for 30 seconds and refetches after expiry", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    mockLiquidationReads();

    const first = await getLiquidationParams();
    vi.advanceTimersByTime(29_000);
    const cached = await getLiquidationParams();

    expect(cached).toBe(first);
    expect(mocks.simulateRead).toHaveBeenCalledTimes(4);

    vi.advanceTimersByTime(1_001);
    const refetched = await getLiquidationParams();

    expect(refetched).not.toBe(first);
    expect(mocks.simulateRead).toHaveBeenCalledTimes(8);
  });

  it("clears the cache with resetLiquidationParamsCache", async () => {
    mockLiquidationReads();

    const first = await getLiquidationParams();
    resetLiquidationParamsCache();
    const second = await getLiquidationParams();

    expect(second).not.toBe(first);
    expect(mocks.simulateRead).toHaveBeenCalledTimes(8);
  });
});
