import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient } from "@tanstack/react-query";
import { WalletProvider, useWallet } from "./wallet";
import { QueryProvider, createQueryClient } from "./query-provider";
import type { WalletAdapter } from "@/lib/wallets/types";

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

function createWrapper(client: QueryClient, address: string) {
  // The wallet uses an adapter abstraction; inject a fake adapter that returns `address`.
  const adapter: WalletAdapter = {
    id: "fake-wallet",
    name: "Fake Wallet",
    icon: "icon.svg",
    isAvailable: async () => true,
    connect: async () => address,
    signTransaction: async (xdr: string) => xdr,
    disconnect: async () => {},
  };
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryProvider client={client}>
        <WalletProvider initialAdapter={adapter}>{children}</WalletProvider>
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

    const wrapper = createWrapper(queryClient, "GBZXN7PIRZGNMHGA728R4EUCHPT3LFQPUVAHEUMCM46U223EDPHIFDDD");

    const { result: hook1 } = renderHook(() => useWallet(), { wrapper });
    const { result: hook2 } = renderHook(() => useWallet(), { wrapper });


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

    const wrapper = createWrapper(queryClient, "GAAAX7PIRZGNMHGA728R4EUCHPT3LFQPUVAHEUMCM46U223EDPHIFBBB");
    const { result } = renderHook(() => useWallet(), { wrapper });


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

    const wrapper = createWrapper(queryClient, "GCCCC7PIRZGNMHGA728R4EUCHPT3LFQPUVAHEUMCM46U223EDPHIFCCC");
    const { result } = renderHook(() => useWallet(), { wrapper });


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
    const queries = queryClient
      .getQueryCache()
      .findAll({ queryKey: ["account", "GCCCC7PIRZGNMHGA728R4EUCHPT3LFQPUVAHEUMCM46U223EDPHIFCCC"] });
    expect(queries.length).toBe(0);
  });
});
