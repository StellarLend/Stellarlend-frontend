import { Address, nativeToScVal, rpc } from "@stellar/stellar-sdk";
import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  decodeLendingEvent,
  formatLendingAmount,
  formatRelativeTime,
  getLendingEvents,
  getTxExplorerUrl,
  type RawEventRecord,
} from "./events";

const userA = Address.fromString("GA5WUJ54Z23KILLCUOUNAKTPBVZWKMQVO4O6EQ5GHLAERIMLLHNCSKYH");
const userB = Address.fromString("GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5");
const timestamp = BigInt(1_700_000_000);

type FixtureSchema = Record<string, ["symbol", "u32" | "address" | "i128" | "u64"]>;

const depositWithdrawSchema: FixtureSchema = {
  schema_version: ["symbol", "u32"],
  user: ["symbol", "address"],
  amount: ["symbol", "i128"],
  new_balance: ["symbol", "i128"],
  timestamp: ["symbol", "u64"],
};

const borrowRepaySchema: FixtureSchema = {
  schema_version: ["symbol", "u32"],
  user: ["symbol", "address"],
  amount: ["symbol", "i128"],
  new_debt: ["symbol", "i128"],
  timestamp: ["symbol", "u64"],
};

function makeFixture(
  eventName: string,
  data: Record<string, unknown>,
  schema: FixtureSchema,
  overrides?: Partial<RawEventRecord>
): RawEventRecord {
  return {
    id: `${eventName}-fixture-id`,
    ledger: 100500,
    transactionIndex: 2,
    operationIndex: 1,
    ledgerClosedAt: "2023-11-14T22:13:20Z",
    txHash: "f".repeat(64),
    topic: [nativeToScVal(eventName, { type: "symbol" })],
    value: nativeToScVal(data, { type: schema }),
    ...overrides,
  };
}

describe("lib/events", () => {
  describe("decodeLendingEvent", () => {
    it("decodes DepositEvent fixture", () => {
      const event = makeFixture(
        "DepositEvent",
        {
          schema_version: 1,
          user: userA,
          amount: BigInt(50_000_000), // 5.0
          new_balance: BigInt(150_000_000), // 15.0
          timestamp,
        },
        depositWithdrawSchema
      );

      const decoded = decodeLendingEvent(event, userA.toString());
      expect(decoded).not.toBeNull();
      expect(decoded).toEqual({
        id: "DepositEvent-fixture-id",
        kind: "deposit",
        user: userA.toString(),
        amount: BigInt(50_000_000),
        after: BigInt(150_000_000),
        timestamp: 1_700_000_000,
        ledger: 100500,
        txHash: "f".repeat(64),
        transactionIndex: 2,
        operationIndex: 1,
      });
    });

    it("decodes WithdrawEvent fixture", () => {
      const event = makeFixture(
        "WithdrawEvent",
        {
          schema_version: 1,
          user: userA,
          amount: BigInt(20_000_000),
          new_balance: BigInt(130_000_000),
          timestamp,
        },
        depositWithdrawSchema
      );

      const decoded = decodeLendingEvent(event, userA.toString());
      expect(decoded).not.toBeNull();
      expect(decoded).toMatchObject({
        kind: "withdraw",
        user: userA.toString(),
        amount: BigInt(20_000_000),
        after: BigInt(130_000_000),
      });
    });

    it("decodes BorrowEvent fixture", () => {
      const event = makeFixture(
        "BorrowEvent",
        {
          schema_version: 1,
          user: userA,
          amount: BigInt(80_000_000),
          new_debt: BigInt(80_000_000),
          timestamp,
        },
        borrowRepaySchema
      );

      const decoded = decodeLendingEvent(event, userA.toString());
      expect(decoded).not.toBeNull();
      expect(decoded).toMatchObject({
        kind: "borrow",
        user: userA.toString(),
        amount: BigInt(80_000_000),
        after: BigInt(80_000_000),
      });
    });

    it("decodes RepayEvent fixture", () => {
      const event = makeFixture(
        "RepayEvent",
        {
          schema_version: 1,
          user: userA,
          amount: BigInt(30_000_000),
          new_debt: BigInt(50_000_000),
          timestamp,
        },
        borrowRepaySchema
      );

      const decoded = decodeLendingEvent(event, userA.toString());
      expect(decoded).not.toBeNull();
      expect(decoded).toMatchObject({
        kind: "repay",
        user: userA.toString(),
        amount: BigInt(30_000_000),
        after: BigInt(50_000_000),
      });
    });

    it("skips events for other users", () => {
      const event = makeFixture(
        "DepositEvent",
        {
          schema_version: 1,
          user: userB,
          amount: BigInt(10_000_000),
          new_balance: BigInt(10_000_000),
          timestamp,
        },
        depositWithdrawSchema
      );

      const decoded = decodeLendingEvent(event, userA.toString());
      expect(decoded).toBeNull();
    });

    it("skips unknown schema_version and logs warning", () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const event = makeFixture(
        "DepositEvent",
        {
          schema_version: 2,
          user: userA,
          amount: BigInt(10_000_000),
          new_balance: BigInt(10_000_000),
          timestamp,
        },
        depositWithdrawSchema
      );

      const decoded = decodeLendingEvent(event, userA.toString());
      expect(decoded).toBeNull();
      expect(warnSpy).toHaveBeenCalled();
      warnSpy.mockRestore();
    });

    it("preserves very large i128 amounts as bigint", () => {
      const largeAmount = BigInt("123456789012345678901234567890");
      const largeAfter = BigInt("987654321098765432109876543210");

      const event = makeFixture(
        "DepositEvent",
        {
          schema_version: 1,
          user: userA,
          amount: largeAmount,
          new_balance: largeAfter,
          timestamp,
        },
        depositWithdrawSchema
      );

      const decoded = decodeLendingEvent(event, userA.toString());
      expect(decoded).not.toBeNull();
      expect(decoded?.amount).toBe(largeAmount);
      expect(decoded?.after).toBe(largeAfter);
      expect(typeof decoded?.amount).toBe("bigint");
      expect(typeof decoded?.after).toBe("bigint");
    });
  });

  describe("formatLendingAmount", () => {
    it("formats 7-decimal amounts accurately", () => {
      expect(formatLendingAmount(BigInt(0))).toBe("0");
      expect(formatLendingAmount(BigInt(10_000_000))).toBe("1");
      expect(formatLendingAmount(BigInt(15_000_000))).toBe("1.5");
      expect(formatLendingAmount(BigInt(12_345_678))).toBe("1.2345678");
      expect(formatLendingAmount(BigInt(100_000_000_000_000))).toBe("10,000,000");
    });
  });

  describe("formatRelativeTime", () => {
    it("formats relative time correctly", () => {
      const now = 1_700_000_120 * 1000;
      const formatted = formatRelativeTime(1_700_000_000, "en", now);
      expect(formatted).toBe("2 minutes ago");
    });
  });

  describe("getTxExplorerUrl", () => {
    it("generates correct stellar.expert URL", () => {
      const url = getTxExplorerUrl("abc123hash");
      expect(url).toContain("stellar.expert/explorer/");
      expect(url).toContain("/tx/abc123hash");
    });
  });

  describe("getLendingEvents cursor & retention error handling", () => {
    beforeEach(() => {
      vi.restoreAllMocks();
    });

    it("passes cursor and pagination options to RPC getEvents", async () => {
      const mockGetEvents = vi.spyOn(rpc.Server.prototype, "getEvents").mockResolvedValue({
        events: [],
        cursor: "next-cursor-token",
        latestLedger: 200,
      } as unknown as rpc.Api.GetEventsResponse);
      vi.spyOn(rpc.Server.prototype, "getHealth").mockResolvedValue({
        status: "healthy",
        oldestLedger: 100,
        latestLedger: 200,
        ledgerRetentionWindow: 100,
      } as unknown as rpc.Api.GetHealthResponse);
      vi.spyOn(rpc.Server.prototype, "getLatestLedger").mockResolvedValue({
        id: "ledger-id",
        protocolVersion: "20",
        sequence: 200,
      } as unknown as rpc.Api.GetLatestLedgerResponse);

      const result = await getLendingEvents({
        contractId: "CC4A6A46O2KQA7KEMOFK3TQ4YRSLCJ4ZP26SQWXIKNF4DTEX3BOL2HF6",
        cursor: "test-cursor-123",
        limit: 10,
        user: userA.toString(),
      });

      expect(mockGetEvents).toHaveBeenCalledWith(
        expect.objectContaining({
          cursor: "test-cursor-123",
          limit: 10,
        })
      );
      expect(result.cursor).toBe("next-cursor-token");
      expect(result.hasMore).toBe(false);
    });

    it("catches startLedger retention error and retries once with clamped ledger", async () => {
      const mockGetEvents = vi
        .spyOn(rpc.Server.prototype, "getEvents")
        .mockRejectedValueOnce(
          new Error("startLedger must be greater than or equal to oldestLedger: 500")
        )
        .mockResolvedValueOnce({
          events: [],
          cursor: "cursor-after-retry",
          latestLedger: 1000,
        } as unknown as rpc.Api.GetEventsResponse);

      vi.spyOn(rpc.Server.prototype, "getHealth").mockResolvedValue({
        status: "healthy",
        oldestLedger: 500,
        latestLedger: 1000,
        ledgerRetentionWindow: 500,
      } as unknown as rpc.Api.GetHealthResponse);
      vi.spyOn(rpc.Server.prototype, "getLatestLedger").mockResolvedValue({
        id: "ledger-id",
        protocolVersion: "20",
        sequence: 1000,
      } as unknown as rpc.Api.GetLatestLedgerResponse);

      const result = await getLendingEvents({
        contractId: "CC4A6A46O2KQA7KEMOFK3TQ4YRSLCJ4ZP26SQWXIKNF4DTEX3BOL2HF6",
        startLedger: 100,
        limit: 20,
      });

      expect(mockGetEvents).toHaveBeenCalledTimes(2);
      expect(mockGetEvents).toHaveBeenLastCalledWith(
        expect.objectContaining({
          startLedger: 500,
        })
      );
      expect(result.cursor).toBe("cursor-after-retry");
    });
  });
});
