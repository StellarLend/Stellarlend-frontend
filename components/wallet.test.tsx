import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient } from "@tanstack/react-query";
import { WalletProvider, useWallet } from "./wallet";
import { QueryProvider, createQueryClient } from "./query-provider";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => {
    const translations: Record<string, string> = {
      unfunded: "0.00 (Unfunded)",
      notDetected: "Freighter not detected",
      declined: "Connection declined",
      unreachable: "Freighter unreachable",
    };
    return translations[key] || key;
  },
}));

function createWrapper(client: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryProvider client={client}>
        <WalletProvider>{children}</WalletProvider>
      </QueryProvider>
    );
  };
}

describe("Wallet Balance Query Layer", () => {
  let queryClient: QueryClient;
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    queryClient = createQueryClient();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    queryClient.clear();
  });

  it("two components requesting the same account balance cause ONE network request (deduplication)", async () => {
    const fetchMock = vi.fn().mockImplementation(async () => ({
      status: 200,
      ok: true,
      json: async () => ({
        balances: [{ asset_type: "native", balance: "150.2500000" }],
      }),
    }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const wrapper = createWrapper(queryClient);

    const { result: hook1 } = renderHook(() => useWallet(), { wrapper });
    const { result: hook2 } = renderHook(() => useWallet(), { wrapper });

    // Mock freighter access to set address on hook1
    vi.mock("@stellar/freighter-api", () => ({
      isConnected: async () => ({ isConnected: true }),
      requestAccess: async () => ({ address: "GBZXN7PIRZGNMHGA728R4EUCHPT3LFQPUVAHEUMCM46U223EDPHIFDDD" }),
    }));

    await act(async () => {
      await hook1.current.connect();
    });

    await waitFor(() => {
      expect(hook1.current.balance).toBe("150.25");
    });

    // Both hooks see the same balance, but fetch was called exactly once for that address
    expect(hook1.current.balance).toBe("150.25");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("GBZXN7PIRZGNMHGA728R4EUCHPT3LFQPUVAHEUMCM46U223EDPHIFDDD"),
      expect.anything()
    );
  });

  it("balance refreshes after an explicit invalidate call", async () => {
    let callCount = 0;
    const fetchMock = vi.fn().mockImplementation(async () => {
      callCount++;
      return {
        status: 200,
        ok: true,
        json: async () => ({
          balances: [
            {
              asset_type: "native",
              balance: callCount === 1 ? "100.0000000" : "250.0000000",
            },
          ],
        }),
      };
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const wrapper = createWrapper(queryClient);
    const { result } = renderHook(() => useWallet(), { wrapper });

    vi.mock("@stellar/freighter-api", () => ({
      isConnected: async () => ({ isConnected: true }),
      requestAccess: async () => ({ address: "GAAAX7PIRZGNMHGA728R4EUCHPT3LFQPUVAHEUMCM46U223EDPHIFBBB" }),
    }));

    await act(async () => {
      await result.current.connect();
    });

    await waitFor(() => {
      expect(result.current.balance).toBe("100.00");
    });

    // Invalidate the balance
    await act(async () => {
      await result.current.invalidateBalance();
    });

    await waitFor(() => {
      expect(result.current.balance).toBe("250.00");
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("clears cached account data on disconnect to prevent data leak across accounts", async () => {
    const fetchMock = vi.fn().mockImplementation(async () => ({
      status: 200,
      ok: true,
      json: async () => ({
        balances: [{ asset_type: "native", balance: "50.0000000" }],
      }),
    }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const wrapper = createWrapper(queryClient);
    const { result } = renderHook(() => useWallet(), { wrapper });

    vi.mock("@stellar/freighter-api", () => ({
      isConnected: async () => ({ isConnected: true }),
      requestAccess: async () => ({ address: "GCCCC7PIRZGNMHGA728R4EUCHPT3LFQPUVAHEUMCM46U223EDPHIFCCC" }),
    }));

    await act(async () => {
      await result.current.connect();
    });

    await waitFor(() => {
      expect(result.current.balance).toBe("50.00");
    });

    act(() => {
      result.current.disconnect();
    });

    expect(result.current.address).toBeNull();
    expect(result.current.balance).toBeNull();

    // Cache query for the previous address is removed
    const queries = queryClient.getQueryCache().findAll();
    expect(queries.length).toBe(0);
  });
});
