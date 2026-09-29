import { renderHook, act } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useMarketplacePurchase } from "./useMarketplacePurchase";
import type { SubmitPurchaseInput } from "./useMarketplacePurchase";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const input: SubmitPurchaseInput = {
  listingId: "lst_collateral_usdc",
  quantity: "10",
  unitPrice: "10000000",
  expectedVersion: 1,
  walletAddress: "GBUYER00000000000000000000000000000000000000000000000000001",
};

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

const successBody = {
  success: true,
  data: {
    purchaseId: "p_lst_2",
    transactionHash: "txn_abcdef",
    quantityFilled: "10",
    listingVersion: 2,
    quantityRemaining: "990",
  },
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useMarketplacePurchase", () => {
  it("succeeds a valid submission", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, successBody));
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useMarketplacePurchase());
    let accepted = false;
    await act(async () => {
      accepted = await result.current.submit(input);
    });

    expect(accepted).toBe(true);
    expect(result.current.isSucceeded).toBe(true);
    expect(result.current.result?.purchaseId).toBe("p_lst_2");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("blocks a duplicate submission while one is in flight", async () => {
    const pending = deferred<Response>();
    const fetchMock = vi.fn(() => pending.promise);
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useMarketplacePurchase());

    let first!: Promise<boolean>;
    await act(async () => {
      first = result.current.submit(input);
    });
    expect(result.current.isSubmitting).toBe(true);

    let second = true;
    await act(async () => {
      second = await result.current.submit(input);
    });
    expect(second).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1); // no second network submission

    await act(async () => {
      pending.resolve(jsonResponse(200, successBody));
      await first;
    });
    expect(result.current.isSucceeded).toBe(true);
  });

  it("enters the recovery state when the request ends ambiguously (network drop)", async () => {
    const pending = deferred<Response>();
    const fetchMock = vi.fn(() => pending.promise);
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useMarketplacePurchase());

    let first!: Promise<boolean>;
    await act(async () => {
      first = result.current.submit(input);
    });

    await act(async () => {
      pending.reject(new TypeError("Failed to fetch"));
    });
    await act(async () => {
      await first;
    });

    expect(result.current.isConfirming).toBe(true);
    expect(result.current.error?.code).toBe("network_error");
  });

  it("stays in the recovery state when reconciliation is inconclusive", async () => {
    const pending = deferred<Response>();
    const fetchMock = vi.fn(() => pending.promise);
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useMarketplacePurchase());

    let first!: Promise<boolean>;
    await act(async () => {
      first = result.current.submit(input);
    });
    await act(async () => {
      pending.reject(new TypeError("Failed to fetch"));
      await first;
    });
    expect(result.current.isConfirming).toBe(true);

    // Reconcile against the server: it has no record -> still confirming.
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { known: false }));
    await act(async () => {
      await result.current.reconcile();
    });
    expect(result.current.isConfirming).toBe(true);
    expect(result.current.isSucceeded).toBe(false);
  });

  it("resolves to the authoritative outcome when reconciliation is conclusive", async () => {
    const pending = deferred<Response>();
    const fetchMock = vi.fn(() => pending.promise);
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useMarketplacePurchase());

    let first!: Promise<boolean>;
    await act(async () => {
      first = result.current.submit(input);
    });
    await act(async () => {
      pending.reject(new TypeError("network"));
      await first;
    });
    expect(result.current.isConfirming).toBe(true);

    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, {
        known: true,
        status: "succeeded",
        data: successBody.data,
      }),
    );
    await act(async () => {
      await result.current.reconcile();
    });
    expect(result.current.isSucceeded).toBe(true);
    expect(result.current.result?.transactionHash).toBe("txn_abcdef");
  });

  it("re-submits on explicit confirmRetry with the SAME idempotency key", async () => {
    const pending = deferred<Response>();
    const fetchMock = vi.fn(() => pending.promise);
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useMarketplacePurchase());

    let first!: Promise<boolean>;
    await act(async () => {
      first = result.current.submit(input);
    });
    await act(async () => {
      pending.reject(new TypeError("network"));
      await first;
    });

    const originalBody = JSON.parse(fetchMock.mock.calls[0][1].body as string);

    // Recovery returns unknown, then the user explicitly confirms a retry.
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, { known: false }))
      .mockResolvedValueOnce(jsonResponse(200, successBody));

    await act(async () => {
      await result.current.reconcile();
    });
    expect(result.current.isConfirming).toBe(true);

    let retried = false;
    await act(async () => {
      retried = await result.current.confirmRetry();
    });
    expect(retried).toBe(true);
    expect(result.current.isSucceeded).toBe(true);

    const retryBody = JSON.parse(
      fetchMock.mock.calls[fetchMock.mock.calls.length - 1][1].body as string,
    );
    expect(retryBody.idempotencyKey).toBe(originalBody.idempotencyKey);
  });

  it("marks the purchase failed on a definitive rejection and surfaces the stale listing", async () => {
    const freshListing = { id: "lst_collateral_usdc", version: 2 };
    const pending = deferred<Response>();
    const fetchMock = vi.fn(() => pending.promise);
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useMarketplacePurchase());

    let first!: Promise<boolean>;
    await act(async () => {
      first = result.current.submit(input);
    });
    await act(async () => {
      pending.resolve(
        jsonResponse(409, {
          success: false,
          code: "inventory_changed",
          error: { code: "inventory_changed", message: "changed", freshListing },
        }),
      );
      await first;
    });

    expect(result.current.isFailed).toBe(true);
    expect(result.current.isConfirming).toBe(false);
    expect(result.current.error?.code).toBe("inventory_changed");
    expect(result.current.freshListing?.version).toBe(2);
  });

  it("cancels an in-flight submission without a network call to undo it", async () => {
    const pending = deferred<Response>();
    const fetchMock = vi.fn(() => pending.promise);
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useMarketplacePurchase());

    await act(async () => {
      result.current.submit(input);
    });
    expect(result.current.isSubmitting).toBe(true);

    await act(async () => {
      result.current.cancel();
    });
    expect(result.current.isCancelled).toBe(true);
  });

  it("resets from a terminal state back to idle", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, successBody));
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useMarketplacePurchase());
    await act(async () => {
      await result.current.submit(input);
    });
    expect(result.current.isSucceeded).toBe(true);

    await act(async () => {
      result.current.reset();
    });
    expect(result.current.isIdle).toBe(true);
    expect(result.current.context).toBeNull();
  });
});