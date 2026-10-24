import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as StellarSdk from "@stellar/stellar-sdk";
import {
  calculateMinReserve,
  parseAccountBalances,
  getAssetKey,
  fetchWithRetry,
  getAccountBalances,
  buildChangeTrustTransaction,
  addTrustline,
} from "./horizon";

describe("lib/horizon", () => {
  describe("getAssetKey", () => {
    it("returns 'native' for native asset", () => {
      expect(getAssetKey("native")).toBe("native");
    });

    it("returns code:issuer for credit asset", () => {
      expect(
        getAssetKey({
          code: "USDC",
          issuer: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
        })
      ).toBe("USDC:GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5");
    });
  });

  describe("calculateMinReserve", () => {
    it("computes base reserve for empty account (2 * 0.5 = 1.0 XLM)", () => {
      expect(calculateMinReserve({})).toBe(1.0);
    });

    it("accounts for subentries: (2 + subentries) * 0.5", () => {
      expect(calculateMinReserve({ subentry_count: 3 })).toBe(2.5);
    });

    it("accounts for sponsorship: (2 + subentries + sponsoring - sponsored) * 0.5", () => {
      expect(
        calculateMinReserve({
          subentry_count: 4,
          num_sponsoring: 2,
          num_sponsored: 1,
        })
      ).toBe(3.5);
    });
  });

  describe("parseAccountBalances", () => {
    it("computes available balances for native and credit assets with liabilities and sponsorship", () => {
      const fixture = {
        id: "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7",
        subentry_count: 2,
        num_sponsoring: 1,
        num_sponsored: 0,
        balances: [
          {
            asset_type: "native",
            balance: "100.0000000",
            buying_liabilities: "2.0000000",
            selling_liabilities: "5.0000000",
          },
          {
            asset_type: "credit_alphanum4",
            asset_code: "USDC",
            asset_issuer: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
            balance: "50.0000000",
            buying_liabilities: "1.0000000",
            selling_liabilities: "10.0000000",
            limit: "10000.0000000",
          },
        ],
      };

      const result = parseAccountBalances(fixture);

      // Reserve: (2 + 2 + 1 - 0) * 0.5 = 2.5 XLM
      // Native available: 100 - 5 (selling) - 2.5 (reserve) = 92.5 XLM
      expect(result["native"]).toBeDefined();
      expect(result["native"].balance).toBe("100.0000000");
      expect(Number(result["native"].available)).toBeCloseTo(92.5, 4);
      expect(result["native"].sellingLiabilities).toBe("5.0000000");
      expect(result["native"].buyingLiabilities).toBe("2.0000000");

      // Credit available: 50 - 10 (selling) = 40.0 USDC
      const usdcKey = "USDC:GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5";
      expect(result[usdcKey]).toBeDefined();
      expect(result[usdcKey].balance).toBe("50.0000000");
      expect(Number(result[usdcKey].available)).toBeCloseTo(40.0, 4);
      expect(result[usdcKey].limit).toBe("10000.0000000");
      expect(result[usdcKey].sellingLiabilities).toBe("10.0000000");
    });

    it("clamps negative available balances to 0", () => {
      const fixture = {
        subentry_count: 10,
        balances: [
          {
            asset_type: "native",
            balance: "2.0000000", // min reserve is 6.0 XLM
            selling_liabilities: "0.0000000",
          },
          {
            asset_type: "credit_alphanum4",
            asset_code: "USDC",
            asset_issuer: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
            balance: "5.0000000",
            selling_liabilities: "10.0000000",
          },
        ],
      };

      const result = parseAccountBalances(fixture);
      expect(Number(result["native"].available)).toBe(0);
      expect(Number(result["USDC"].available)).toBe(0);
    });
  });

  describe("getAccountBalances & fetchWithRetry", () => {
    beforeEach(() => {
      vi.stubGlobal("fetch", vi.fn());
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it("handles 404 unfunded account gracefully without throwing", async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        status: 404,
        ok: false,
      } as Response);

      const result = await getAccountBalances("GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7", "https://horizon-testnet.stellar.org");
      expect(result.isUnfunded).toBe(true);
      expect(result.balances).toEqual({});
    });

    it("retries on 5xx errors with backoff and succeeds when server recovers", async () => {
      vi.mocked(fetch)
        .mockResolvedValueOnce({
          status: 503,
          ok: false,
        } as Response)
        .mockResolvedValueOnce({
          status: 200,
          ok: true,
          json: async () => ({
            id: "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7",
            subentry_count: 0,
            balances: [{ asset_type: "native", balance: "50.0000000" }],
          }),
        } as Response);

      const result = await getAccountBalances("GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7", "https://horizon-testnet.stellar.org");
      expect(result.isUnfunded).toBe(false);
      expect(result.balances["native"]).toBeDefined();
      expect(Number(result.balances["native"].available)).toBeCloseTo(49.0, 4);
      expect(fetch).toHaveBeenCalledTimes(2);
    });
  });

  describe("buildChangeTrustTransaction", () => {
    it("builds a transaction with exactly one changeTrust operation for the specified asset", () => {
      const account = new StellarSdk.Account(
        "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7",
        "100"
      );
      const asset = {
        code: "USDC",
        issuer: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
      };
      const networkPassphrase = "Test SDF Network ; September 2015";

      const tx = buildChangeTrustTransaction({
        account,
        asset,
        networkPassphrase,
      });

      // Decode the transaction from XDR to verify structure
      const decoded = StellarSdk.TransactionBuilder.fromXDR(
        tx.toXDR(),
        networkPassphrase
      ) as StellarSdk.Transaction;

      expect(decoded.operations).toHaveLength(1);
      const op = decoded.operations[0] as StellarSdk.Operation.ChangeTrust;
      expect(op.type).toBe("changeTrust");
      const line = op.line as StellarSdk.Asset;
      expect(line.getCode()).toBe("USDC");
      expect(line.getIssuer()).toBe("GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5");
    });
  });

  describe("addTrustline", () => {
    beforeEach(() => {
      vi.stubGlobal("fetch", vi.fn());
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it("pre-checks and rejects if available XLM is insufficient for new subentry reserve", async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        status: 200,
        ok: true,
        json: async () => ({
          id: "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7",
          sequence: "200",
          subentry_count: 2,
          balances: [
            {
              asset_type: "native",
              balance: "2.1000000", // reserve is 2.0 XLM, available is only 0.1 XLM (< 0.5)
            },
          ],
        }),
      } as Response);

      await expect(
        addTrustline({
          address: "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7",
          asset: {
            code: "USDC",
            issuer: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
          },
        })
      ).rejects.toThrow(/Insufficient XLM/);
    });
  });
});
