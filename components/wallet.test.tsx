import { render, screen, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { WalletProvider, useWallet, LAST_WALLET_STORAGE_KEY } from "./wallet";
import { WalletAdapter } from "@/lib/wallets/types";

// Mock next-intl
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => {
    const messages: Record<string, string> = {
      notDetected: "Wallet not detected",
      declined: "Connection declined",
      unreachable: "Wallet unreachable",
      unfunded: "Unfunded",
      disconnect: "Disconnect",
      connectFreighter: "Connect Wallet",
      connectWallet: "Connect a Wallet",
      loadingWallets: "Loading available wallets...",
      recent: "Recent",
      available: "Available",
      notInstalled: "Not installed",
      install: "Install",
      connecting: "Connecting...",
      close: "Close",
    };
    return messages[key] || key;
  },
}));

// Mock fetch
global.fetch = vi.fn().mockImplementation(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ balances: [{ asset_type: "native", balance: "100.50" }] }),
  })
);

function TestConsumer({ onSign }: { onSign?: (res: string) => void }) {
  const { address, balance, error, connect, disconnect, signTransaction, activeWalletId } =
    useWallet();

  return (
    <div>
      <span data-testid="address">{address ?? "no-address"}</span>
      <span data-testid="balance">{balance ?? "no-balance"}</span>
      <span data-testid="error">{error ?? "no-error"}</span>
      <span data-testid="activeWallet">{activeWalletId ?? "none"}</span>
      <button data-testid="connect-btn" onClick={() => connect().catch(() => {})}>
        {""}
      </button>
      <button data-testid="disconnect-btn" onClick={() => disconnect()}>
        {""}
      </button>
      <button
        data-testid="sign-btn"
        onClick={async () => {
          try {
            const res = await signTransaction("dummy-xdr");
            onSign?.(res);
          } catch (e: unknown) {
            onSign?.((e as Error).message);
          }
        }}
      >
        {""}
      </button>
    </div>
  );
}

describe("WalletContext with Adapter", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it("connects successfully via fake adapter and updates context", async () => {
    const fakeAdapter: WalletAdapter = {
      id: "fake-wallet",
      name: "Fake Wallet",
      icon: "icon.svg",
      isAvailable: vi.fn().mockResolvedValue(true),
      connect: vi.fn().mockResolvedValue("GBF...TEST1234"),
      signTransaction: vi.fn().mockResolvedValue("signed-xdr-result"),
      disconnect: vi.fn().mockResolvedValue(undefined),
    };

    render(
      <WalletProvider initialAdapter={fakeAdapter}>
        <TestConsumer />
      </WalletProvider>
    );

    expect(screen.getByTestId("address").textContent).toBe("no-address");

    await act(async () => {
      screen.getByTestId("connect-btn").click();
    });

    expect(fakeAdapter.connect).toHaveBeenCalled();
    expect(screen.getByTestId("address").textContent).toBe("GBF...TEST1234");
    expect(screen.getByTestId("activeWallet").textContent).toBe("fake-wallet");
    expect(localStorage.getItem(LAST_WALLET_STORAGE_KEY)).toBe("fake-wallet");
  });

  it("passes through signTransaction with networkPassphrase", async () => {
    const fakeAdapter: WalletAdapter = {
      id: "fake-wallet",
      name: "Fake Wallet",
      icon: "icon.svg",
      isAvailable: vi.fn().mockResolvedValue(true),
      connect: vi.fn().mockResolvedValue("GBF...TEST1234"),
      signTransaction: vi.fn().mockResolvedValue("signed-xdr-result"),
      disconnect: vi.fn().mockResolvedValue(undefined),
    };

    let signResult = "";
    render(
      <WalletProvider initialAdapter={fakeAdapter}>
        <TestConsumer onSign={(res) => (signResult = res)} />
      </WalletProvider>
    );

    await act(async () => {
      screen.getByTestId("connect-btn").click();
    });

    await act(async () => {
      screen.getByTestId("sign-btn").click();
    });

    expect(fakeAdapter.signTransaction).toHaveBeenCalledWith(
      "dummy-xdr",
      expect.objectContaining({
        accountToSign: "GBF...TEST1234",
        networkPassphrase: expect.any(String),
      })
    );
    expect(signResult).toBe("signed-xdr-result");
  });

  it("handles disconnect correctly", async () => {
    const fakeAdapter: WalletAdapter = {
      id: "fake-wallet",
      name: "Fake Wallet",
      icon: "icon.svg",
      isAvailable: vi.fn().mockResolvedValue(true),
      connect: vi.fn().mockResolvedValue("GBF...TEST1234"),
      signTransaction: vi.fn().mockResolvedValue("signed-xdr-result"),
      disconnect: vi.fn().mockResolvedValue(undefined),
    };

    render(
      <WalletProvider initialAdapter={fakeAdapter}>
        <TestConsumer />
      </WalletProvider>
    );

    await act(async () => {
      screen.getByTestId("connect-btn").click();
    });
    expect(screen.getByTestId("address").textContent).toBe("GBF...TEST1234");

    await act(async () => {
      screen.getByTestId("disconnect-btn").click();
    });

    expect(fakeAdapter.disconnect).toHaveBeenCalled();
    expect(screen.getByTestId("address").textContent).toBe("no-address");
    expect(screen.getByTestId("balance").textContent).toBe("no-balance");
  });

  it("does not set error banner when user cancels / rejects connection", async () => {
    const fakeAdapter: WalletAdapter = {
      id: "fake-wallet",
      name: "Fake Wallet",
      icon: "icon.svg",
      isAvailable: vi.fn().mockResolvedValue(true),
      connect: vi.fn().mockRejectedValue(new Error("User rejected connection request")),
      signTransaction: vi.fn().mockResolvedValue(""),
      disconnect: vi.fn().mockResolvedValue(undefined),
    };

    render(
      <WalletProvider initialAdapter={fakeAdapter}>
        <TestConsumer />
      </WalletProvider>
    );

    await act(async () => {
      screen.getByTestId("connect-btn").click();
    });

    // Cancellation should NOT result in an error banner
    expect(screen.getByTestId("error").textContent).toBe("no-error");
  });

  it("sets error banner when adapter throws non-cancellation error", async () => {
    const fakeAdapter: WalletAdapter = {
      id: "fake-wallet",
      name: "Fake Wallet",
      icon: "icon.svg",
      isAvailable: vi.fn().mockResolvedValue(true),
      connect: vi.fn().mockRejectedValue(new Error("Internal adapter failure")),
      signTransaction: vi.fn().mockResolvedValue(""),
      disconnect: vi.fn().mockResolvedValue(undefined),
    };

    render(
      <WalletProvider initialAdapter={fakeAdapter}>
        <TestConsumer />
      </WalletProvider>
    );

    await act(async () => {
      screen.getByTestId("connect-btn").click();
    });

    expect(screen.getByTestId("error").textContent).toBe("Internal adapter failure");
  });
});
