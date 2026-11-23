import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as StellarSdk from "@stellar/stellar-sdk";
import {
  calculateMinReserve,
  parseAccountBalances,
  getAssetKey,
  needsTrustline,
  classifyTrustlineError,
  fetchWithRetry,
  HorizonTimeoutError,
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

  describe("needsTrustline", () => {
    const usdc = {
      asset: {
        code: "USDC",
        issuer: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
      },
    };
    const usdcKey = "USDC:GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5";

    it("detects missing trustline when the classic asset is absent from the balances map", () => {
      expect(needsTrustline(usdc, {})).toBe(true);
    });

    it("returns false once the trustline is present in the balances map", () => {
      const balances = {
        [usdcKey]: {
          assetType: "credit_alphanum4",
          code: "USDC",
          issuer: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
          balance: "0.0000000",
          available: "0.0000000",
          buyingLiabilities: "0",
          sellingLiabilities: "0",
        },
      };
      expect(needsTrustline(usdc, balances)).toBe(false);
    });

    it("returns false for native markets", () => {
      expect(needsTrustline({ asset: "native" }, {})).toBe(false);
    });
  });

  describe("classifyTrustlineError", () => {
    it("maps user rejection to the rejected kind", () => {
      expect(classifyTrustlineError(new Error("Transaction was rejected or cancelled by user"))).toBe(
        "rejected"
      );
    });

    it("maps op_low_reserve to the lowReserve kind", () => {
      expect(classifyTrustlineError(new Error("op_low_reserve"))).toBe("lowReserve");
    });

    it("falls back to failed for unrelated errors", () => {
      expect(classifyTrustlineError(new Error("network connection reset"))).toBe("failed");
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
      vi.useRealTimers();
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

    it("uses the default 8 second timeout and aborts a hung request", async () => {
      vi.useFakeTimers();
      let aborted = false;
      vi.mocked(fetch).mockImplementation((_url, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            aborted = true;
            reject(init.signal?.reason);
          });
        })
      );

      const request = fetchWithRetry("https://horizon.example/accounts/G...", {}, 1);
      const assertion = expect(request).rejects.toBeInstanceOf(HorizonTimeoutError);
      await vi.advanceTimersByTimeAsync(7_999);
      expect(aborted).toBe(false);
      await vi.advanceTimersByTimeAsync(1);
      await assertion;
      expect(aborted).toBe(true);
    });

    it("retries timed out attempts and throws a typed timeout after exhaustion", async () => {
      vi.useFakeTimers();
      const signals: AbortSignal[] = [];
      vi.mocked(fetch).mockImplementation((_url, init) => {
        signals.push(init?.signal as AbortSignal);
        return new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(init.signal?.reason));
        });
      });

      const request = fetchWithRetry("https://horizon.example/accounts/G...", {}, 2, 10, {
        timeoutMs: 50,
        random: () => 0.5,
      });
      const assertion = expect(request).rejects.toMatchObject({ name: "HorizonTimeoutError", timeoutMs: 50 });
      await vi.advanceTimersByTimeAsync(50);
      await vi.advanceTimersByTimeAsync(10);
      await vi.advanceTimersByTimeAsync(50);
      await assertion;
      expect(fetch).toHaveBeenCalledTimes(2);
      expect(signals.every((signal) => signal.aborted)).toBe(true);
    });

    it("respects caller cancellation without misreporting it as a timeout", async () => {
      vi.useFakeTimers();
      const caller = new AbortController();
      vi.mocked(fetch).mockImplementation((_url, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(init.signal?.reason));
        })
      );

      const request = fetchWithRetry("https://horizon.example/accounts/G...", { signal: caller.signal }, 2, 10, {
        timeoutMs: 8_000,
      });
      caller.abort(new Error("caller cancelled"));
      await expect(request).rejects.toThrow("caller cancelled");
      await expect(request).rejects.not.toBeInstanceOf(HorizonTimeoutError);
      expect(fetch).toHaveBeenCalledTimes(1);
    });

    it("does not retry 4xx responses", async () => {
      vi.mocked(fetch).mockResolvedValue({ status: 429, ok: false } as Response);
      const response = await fetchWithRetry("https://horizon.example/accounts/G...");
      expect(response.status).toBe(429);
      expect(fetch).toHaveBeenCalledTimes(1);
    });

    it("returns the final 5xx response after retries are exhausted", async () => {
      vi.useFakeTimers();
      vi.mocked(fetch).mockResolvedValue({ status: 503, ok: false } as Response);
      const request = fetchWithRetry("https://horizon.example/accounts/G...", {}, 2, 10, {
        random: () => 0.5,
      });
      await vi.advanceTimersByTimeAsync(10);
      await expect(request).resolves.toMatchObject({ status: 503 });
      expect(fetch).toHaveBeenCalledTimes(2);
    });

    it("keeps retry jitter within 80% to 120% of the base delay", async () => {
      vi.useFakeTimers();
      vi.mocked(fetch).mockResolvedValue({ status: 503, ok: false } as Response);
      const low = fetchWithRetry("https://horizon.example/accounts/G...", {}, 2, 200, {
        random: () => 0,
      });
      await vi.advanceTimersByTimeAsync(159);
      expect(fetch).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(1);
      await low;

      vi.mocked(fetch).mockReset().mockResolvedValue({ status: 503, ok: false } as Response);
      const high = fetchWithRetry("https://horizon.example/accounts/G...", {}, 2, 200, {
        random: () => 1,
      });
      await vi.advanceTimersByTimeAsync(239);
      expect(fetch).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(1);
      await high;
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
