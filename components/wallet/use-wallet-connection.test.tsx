/**
 * Focused tests for useWalletConnection.
 * Uses a minimal QueryProvider so the hook can call useQueryClient internally.
 */
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useWalletConnection } from "./use-wallet-connection";
import { LAST_WALLET_STORAGE_KEY, AUTOCONNECT_STORAGE_KEY } from "./constants";
import type { WalletAdapter } from "@/lib/wallets/types";

vi.mock("@stellar/freighter-api", () => ({
  isConnected: vi.fn(async () => ({ isConnected: false })),
  isAllowed: vi.fn(async () => ({ isAllowed: false })),
  getAddress: vi.fn(async () => ({ error: true })),
  getNetwork: vi.fn(async () => ({
    network: "testnet",
    networkPassphrase: "Test SDF Network ; September 2015",
  })),
  WatchWalletChanges: undefined,
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

function makeAdapter(address: string): WalletAdapter {
  return {
    id: "test-wallet",
    name: "Test Wallet",
    icon: "icon.svg",
    isAvailable: vi.fn().mockResolvedValue(true),
    connect: vi.fn().mockResolvedValue(address),
    signTransaction: vi.fn().mockResolvedValue(""),
    disconnect: vi.fn().mockResolvedValue(undefined),
  };
}

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe("useWalletConnection", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it("starts disconnected", () => {
    const { result } = renderHook(() => useWalletConnection({}), { wrapper });
    expect(result.current.address).toBeNull();
    expect(result.current.activeWalletId).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it("connects and updates address, activeWalletId, and storage", async () => {
    const adapter = makeAdapter("GBF...TEST");
    const { result } = renderHook(() => useWalletConnection({ initialAdapter: adapter }), {
      wrapper,
    });

    await act(async () => {
      await result.current.connect();
    });

    expect(result.current.address).toBe("GBF...TEST");
    expect(result.current.activeWalletId).toBe("test-wallet");
    expect(localStorage.getItem(LAST_WALLET_STORAGE_KEY)).toBe("test-wallet");
    expect(localStorage.getItem(AUTOCONNECT_STORAGE_KEY)).toBe("true");
  });

  it("disconnect clears address and sets autoconnect to false", async () => {
    const adapter = makeAdapter("GBF...TEST");
    const { result } = renderHook(() => useWalletConnection({ initialAdapter: adapter }), {
      wrapper,
    });

    await act(async () => {
      await result.current.connect();
    });

    expect(result.current.address).toBe("GBF...TEST");

    act(() => {
      result.current.disconnect();
    });

    expect(result.current.address).toBeNull();
    expect(result.current.activeWalletId).toBeNull();
    expect(localStorage.getItem(AUTOCONNECT_STORAGE_KEY)).toBeNull();
  });

  it("sets error on non-rejection adapter failure", async () => {
    const adapter: WalletAdapter = {
      id: "broken-wallet",
      name: "Broken",
      icon: "",
      isAvailable: vi.fn().mockResolvedValue(true),
      connect: vi.fn().mockRejectedValue(new Error("Internal failure")),
      signTransaction: vi.fn(),
      disconnect: vi.fn(),
    };

    const { result } = renderHook(() => useWalletConnection({ initialAdapter: adapter }), {
      wrapper,
    });

    await act(async () => {
      try {
        await result.current.connect();
      } catch {
        // expected
      }
    });

    // The error normalizer maps "Internal failure" to WalletErrorCode "unknown"
    // which then uses the t("errors.unknown") message key (mocked to return the key)
    expect(result.current.error).toBeTruthy();
  });

  it("does not set error when user rejects connection", async () => {
    const adapter: WalletAdapter = {
      id: "reject-wallet",
      name: "Reject",
      icon: "",
      isAvailable: vi.fn().mockResolvedValue(true),
      connect: vi.fn().mockRejectedValue(new Error("User rejected connection request")),
      signTransaction: vi.fn(),
      disconnect: vi.fn(),
    };

    const { result } = renderHook(() => useWalletConnection({ initialAdapter: adapter }), {
      wrapper,
    });

    await act(async () => {
      try {
        await result.current.connect();
      } catch {
        // expected rejection
      }
    });

    expect(result.current.error).toBeNull();
  });

  it("openPicker and closePicker toggle isPickerOpen", () => {
    const { result } = renderHook(() => useWalletConnection({}), { wrapper });

    expect(result.current.isPickerOpen).toBe(false);
    act(() => result.current.openPicker());
    expect(result.current.isPickerOpen).toBe(true);
    act(() => result.current.closePicker());
    expect(result.current.isPickerOpen).toBe(false);
  });
});
