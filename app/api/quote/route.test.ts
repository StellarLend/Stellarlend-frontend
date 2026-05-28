import { describe, it, expect } from "vitest";
import { POST } from "./route";

describe("POST /api/quote", () => {
  it("returns a lending quote for valid input", async () => {
    const response = await POST(
      new Request("http://localhost/api/quote", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          type: "lend",
          data: {
            asset: "XLM",
            amount: 1000,
            interestRate: 10,
            duration: 30,
          },
        }),
      })
    );

    expect(response.status).toBe(200);
    const json = (await response.json()) as {
      result: { dailyEarnings: number; totalEarnings: number };
    };

    expect(json.result.dailyEarnings).toBeCloseTo(0.273972602739726, 10);
    expect(json.result.totalEarnings).toBeCloseTo(8.21917808219178, 10);
  });

  it("returns a borrowing quote for valid input", async () => {
    const response = await POST(
      new Request("http://localhost/api/quote", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          type: "borrow",
          data: {
            asset: "XLM",
            amount: 1000,
            interestRate: 12,
            duration: 30,
          },
        }),
      })
    );

    expect(response.status).toBe(200);
    const json = (await response.json()) as {
      result: {
        monthlyPayment: number;
        totalRepayment: number;
        totalEarnings: number;
        dailyEarnings: number;
      };
    };

    expect(json.result.monthlyPayment).toBeCloseTo(1010, 10);
    expect(json.result.totalRepayment).toBeCloseTo(1010, 10);
    expect(json.result.totalEarnings).toBeCloseTo(10, 10);
    expect(json.result.dailyEarnings).toBeCloseTo(10 / 30, 10);
  });

  it("rejects invalid input", async () => {
    const response = await POST(
      new Request("http://localhost/api/quote", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          type: "lend",
          data: {
            asset: "XLM",
            amount: 0,
            interestRate: 10,
            duration: 30,
          },
        }),
      })
    );

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error.code).toBe("INVALID_INPUT");
  });
});

