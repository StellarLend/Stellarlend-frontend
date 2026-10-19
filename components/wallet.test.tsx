import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { WalletProvider, useWallet } from "./wallet";
import { config } from "@/lib/config";

// Mock next-intl
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => {
    const messages: Record<string, string> = {
      unfunded: "0.00 (unfunded on testnet)",
      notDetected: "Freighter wallet not detected",
      declined: "Wallet connection was declined",
      unreachable: "Could not reach Freighter",
      funding: "Funding...",
      fundWithFriendbot: "Fund with Friendbot",
    };
    return messages[key] || key;
  },
}));

// Mock @stellar/freighter-api
vi.mock("@stellar/freighter-api", () => ({
  isConnected: vi.fn().mockResolvedValue({ isConnected: true }),
  requestAccess: vi.fn().mockResolvedValue({ address: "GCXKG6RN4ONIEPCMNFB732A436Z5PNDSRLGWK7GBLCMQLIFO4HXQIUX4" }),
}));

describe("Wallet Context", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    config.network = "testnet";
  });

  it("sets accountStatus to 'unknown' initially before connect", () => {
    const { result } = renderHook(() => useWallet(), {
      wrapper: ({ children }) => <WalletProvider>{children}</WalletProvider>,
    });

    expect(result.current.address).toBeNull();
    expect(result.current.accountStatus).toBe("unknown");
    expect(result.current.balance).toBeNull();
  });

  it("handles 404 from Horizon as unfunded accountStatus", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
    } as unknown as Response);

    const { result } = renderHook(() => useWallet(), {
      wrapper: ({ children }) => <WalletProvider>{children}</WalletProvider>,
    });

    await act(async () => {
      await result.current.connect();
    });

    await waitFor(() => {
      expect(result.current.address).toBe("GCXKG6RN4ONIEPCMNFB732A436Z5PNDSRLGWK7GBLCMQLIFO4HXQIUX4");
      expect(result.current.accountStatus).toBe("unfunded");
      expect(result.current.balance).toBe("0.00 (unfunded on testnet)");
    });
  });

  it("handles 200 with native balance as funded accountStatus", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        balances: [{ asset_type: "native", balance: "150.2500000" }],
      }),
    } as unknown as Response);

    const { result } = renderHook(() => useWallet(), {
      wrapper: ({ children }) => <WalletProvider>{children}</WalletProvider>,
    });

    await act(async () => {
      await result.current.connect();
    });

    await waitFor(() => {
      expect(result.current.accountStatus).toBe("funded");
      expect(result.current.balance).toBe("150.25");
    });
  });

  it("handles network error as error accountStatus", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("Network failed"));

    const { result } = renderHook(() => useWallet(), {
      wrapper: ({ children }) => <WalletProvider>{children}</WalletProvider>,
    });

    await act(async () => {
      await result.current.connect();
    });

    await waitFor(() => {
      expect(result.current.accountStatus).toBe("error");
      expect(result.current.balance).toBeNull();
    });
  });

  it("disconnect resets address and status to unknown", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        balances: [{ asset_type: "native", balance: "50.0000000" }],
      }),
    } as unknown as Response);

    const { result } = renderHook(() => useWallet(), {
      wrapper: ({ children }) => <WalletProvider>{children}</WalletProvider>,
    });

    await act(async () => {
      await result.current.connect();
    });

    await waitFor(() => {
      expect(result.current.accountStatus).toBe("funded");
    });

    act(() => {
      result.current.disconnect();
    });

    expect(result.current.address).toBeNull();
    expect(result.current.balance).toBeNull();
    expect(result.current.accountStatus).toBe("unknown");
  });
});
