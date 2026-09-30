import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  TRANSACTION_DEFAULT_PAGE,
  TRANSACTION_DEFAULT_PAGE_SIZE,
  TRANSACTION_MAX_PAGE_SIZE,
  transactionBodySchema,
  transactionQuerySchema,
} from "@/lib/validation/schemas/transactions";

describe("transactionQuerySchema", () => {
  it("applies defaults when params are omitted", () => {
    const parsed = transactionQuerySchema.parse({});
    expect(parsed.page).toBe(TRANSACTION_DEFAULT_PAGE);
    expect(parsed.pageSize).toBe(TRANSACTION_DEFAULT_PAGE_SIZE);
    expect(parsed.sortBy).toBe("date");
    expect(parsed.sortDir).toBe("desc");
  });

  it("soft-falls back invalid page/pageSize to defaults", () => {
    const parsed = transactionQuerySchema.parse({ page: "abc", pageSize: "-1" });
    expect(parsed.page).toBe(TRANSACTION_DEFAULT_PAGE);
    expect(parsed.pageSize).toBe(TRANSACTION_DEFAULT_PAGE_SIZE);
  });

  it("caps pageSize at the max", () => {
    const parsed = transactionQuerySchema.parse({ pageSize: "999" });
    expect(parsed.pageSize).toBe(TRANSACTION_MAX_PAGE_SIZE);
  });

  it("accepts canonical asset/type/status filters", () => {
    const parsed = transactionQuerySchema.parse({
      asset: "XLM",
      type: "Deposit",
      status: "Completed",
    });
    expect(parsed.asset).toBe("XLM");
    expect(parsed.type).toBe("Deposit");
    expect(parsed.status).toBe("Completed");
  });

  it("rejects unknown asset/type/status with route-compatible messages", () => {
    expect(transactionQuerySchema.safeParse({ asset: "STRK" }).success).toBe(false);
    expect(transactionQuerySchema.safeParse({ type: "deposit" }).success).toBe(false);
    expect(transactionQuerySchema.safeParse({ status: "pending" }).success).toBe(false);

    const assetError = transactionQuerySchema.safeParse({ asset: "STRK" });
    expect(assetError.success).toBe(false);
    if (!assetError.success) {
      expect(assetError.error.issues[0]?.message).toMatch(/Unknown asset/);
    }
  });
});

describe("transactionBodySchema", () => {
  const validBody = {
    asset: "XLM",
    type: "Deposit",
    status: "Completed",
    amount: 100,
    date: "2025-01-01",
    time: "09:00AM",
  };

  it("accepts a valid create payload", () => {
    expect(transactionBodySchema.parse(validBody)).toEqual(validBody);
  });

  it("rejects non-numeric amount", () => {
    const result = transactionBodySchema.safeParse({ ...validBody, amount: "100" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toMatch(/amount must be a number/);
    }
  });

  it("rejects unknown vocabulary values", () => {
    expect(transactionBodySchema.safeParse({ ...validBody, asset: "DOGE" }).success).toBe(false);
    expect(transactionBodySchema.safeParse({ ...validBody, type: "Transfer" }).success).toBe(false);
    expect(transactionBodySchema.safeParse({ ...validBody, status: "Pending" }).success).toBe(false);
  });
});

describe("regression: schemas are wired into GET/POST /api/transactions", () => {
  it("imports transactionQuerySchema and transactionBodySchema from the shared schema module", () => {
    const routeSource = readFileSync(
      resolve(process.cwd(), "app/api/transactions/route.ts"),
      "utf8",
    );

    expect(routeSource).toContain("transactionQuerySchema");
    expect(routeSource).toContain("transactionBodySchema");
    expect(routeSource).toContain("@/lib/validation/schemas/transactions");
    expect(routeSource).toMatch(/transactionQuerySchema\.safeParse/);
    expect(routeSource).toMatch(/transactionBodySchema\.safeParse/);
  });
});
