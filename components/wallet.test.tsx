import React from "react";
import { render, screen, act, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { NextIntlClientProvider } from "next-intl";
import { WalletProvider, useWallet, ConnectButton, AUTOCONNECT_STORAGE_KEY } from "./wallet";
import { NetworkBanner } from "./network-banner";
import messages from "@/messages/en.json";

// Mock @stellar/freighter-api
const mocks = vi.hoisted(() => {
  const holder = {
    callback: null as ((params: any) => void) | null,
  };
  const mockWatcherStop = vi.fn();

  class MockWatchWalletChanges {
    watch(cb: (params: any) => void) {
      holder.callback = cb;
      return {};
    }
    stop() {
      mockWatcherStop();
    }
  }

  return {
    holder,
    mockWatcherStop,
    MockWatchWalletChanges,
    mockIsConnected: vi.fn(),
    mockIsAllowed: vi.fn(),
    mockGetAddress: vi.fn(),
    mockRequestAccess: vi.fn(),
    mockGetNetwork: vi.fn(),
  };
});

vi.mock("@stellar/freighter-api", () => {
  return {
    isConnected: (...args: any[]) => mocks.mockIsConnected(...args),
    isAllowed: (...args: any[]) => mocks.mockIsAllowed(...args),
    getAddress: (...args: any[]) => mocks.mockGetAddress(...args),
    requestAccess: (...args: any[]) => mocks.mockRequestAccess(...args),
    getNetwork: (...args: any[]) => mocks.mockGetNetwork(...args),
    WatchWalletChanges: mocks.MockWatchWalletChanges,
  };
});

function TestConsumer() {
  const wallet = useWallet();
  return (
    <div>
      <div data-testid="address">{wallet.address ?? "none"}</div>
      <div data-testid="balance">{wallet.balance ?? "none"}</div>
      <div data-testid="network">{wallet.network ?? "none"}</div>
      <div data-testid="networkMismatch">{wallet.networkMismatch ? "true" : "false"}</div>
      <button data-testid="connect-btn" onClick={wallet.connect}>
        Connect
      </button>
      <button data-testid="disconnect-btn" onClick={wallet.disconnect}>
        Disconnect
      </button>
      <button
        data-testid="sign-btn"
        onClick={() => {
          try {
            wallet.assertCanSign();
          } catch (e: any) {
            const el = document.getElementById("sign-error");
            if (el) el.textContent = e.name;
          }
        }}
      >
        Sign
      </button>
      <div id="sign-error"></div>
    </div>
  );
}

function renderWithProviders() {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <WalletProvider>
        <NetworkBanner />
        <TestConsumer />
        <ConnectButton />
      </WalletProvider>
    </NextIntlClientProvider>
  );
}

describe("WalletProvider and Freighter session management", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.holder.callback = null;
    window.localStorage.clear();

    mocks.mockIsConnected.mockResolvedValue({ isConnected: true });
    mocks.mockIsAllowed.mockResolvedValue({ isAllowed: false });
    mocks.mockGetAddress.mockResolvedValue({ address: "GCFAKEADDRESS" });
    mocks.mockRequestAccess.mockResolvedValue({ address: "GCFAKEADDRESS" });
    mocks.mockGetNetwork.mockResolvedValue({
      network: "TESTNET",
      networkPassphrase: "Test SDF Network ; September 2015",
    });

    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) => {
        if (url.includes("/accounts/")) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                balances: [{ asset_type: "native", balance: "123.456" }],
              }),
          });
        }
        return Promise.resolve({ ok: false });
      })
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("restores session when allowed and autoconnect flag is present", async () => {
    window.localStorage.setItem(AUTOCONNECT_STORAGE_KEY, "true");
    mocks.mockIsAllowed.mockResolvedValue({ isAllowed: true });
    mocks.mockGetAddress.mockResolvedValue({ address: "GCRESTOREDADDRESS" });

    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByTestId("address").textContent).toBe("GCRESTOREDADDRESS");
    });
    expect(mocks.mockGetAddress).toHaveBeenCalled();
  });

  it("does not restore session when isAllowed returns false", async () => {
    window.localStorage.setItem(AUTOCONNECT_STORAGE_KEY, "true");
    mocks.mockIsAllowed.mockResolvedValue({ isAllowed: false });

    renderWithProviders();

    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });

    expect(screen.getByTestId("address").textContent).toBe("none");
    expect(mocks.mockGetAddress).not.toHaveBeenCalled();
  });

  it("does not restore session when autoconnect flag is absent even if allowed", async () => {
    mocks.mockIsAllowed.mockResolvedValue({ isAllowed: true });

    renderWithProviders();

    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });

    expect(screen.getByTestId("address").textContent).toBe("none");
    expect(mocks.mockGetAddress).not.toHaveBeenCalled();
  });

  it("handles account change event from WatchWalletChanges", async () => {
    renderWithProviders();

    expect(screen.getByTestId("address").textContent).toBe("none");

    await act(async () => {
      if (mocks.holder.callback) {
        mocks.holder.callback({
          address: "GCSWITCHEDACCOUNT",
          network: "TESTNET",
          networkPassphrase: "Test SDF Network ; September 2015",
        });
      }
    });

    expect(screen.getByTestId("address").textContent).toBe("GCSWITCHEDACCOUNT");
    await waitFor(() => {
      expect(screen.getByTestId("balance").textContent).toBe("123.46");
    });
  });

  it("detects network change, shows mismatch banner, and assertCanSign throws", async () => {
    renderWithProviders();

    await act(async () => {
      if (mocks.holder.callback) {
        mocks.holder.callback({
          address: "GCTESTACCOUNT",
          network: "PUBLIC",
          networkPassphrase: "Public Global Stellar Network ; September 2015",
        });
      }
    });

    expect(screen.getByTestId("networkMismatch").textContent).toBe("true");

    // Network banner should be rendered
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText(/Network mismatch detected/i)).toBeInTheDocument();

    // assertCanSign should throw NetworkMismatchError
    const signBtn = screen.getByTestId("sign-btn");
    act(() => {
      signBtn.click();
    });
    expect(document.getElementById("sign-error")?.textContent).toBe("NetworkMismatchError");
  });

  it("disconnect clears the autoconnect flag and resets state", async () => {
    window.localStorage.setItem(AUTOCONNECT_STORAGE_KEY, "true");
    mocks.mockIsAllowed.mockResolvedValue({ isAllowed: true });
    mocks.mockGetAddress.mockResolvedValue({ address: "GCCONNECTED" });

    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByTestId("address").textContent).toBe("GCCONNECTED");
    });

    const disconnectBtn = screen.getByTestId("disconnect-btn");
    act(() => {
      disconnectBtn.click();
    });

    expect(screen.getByTestId("address").textContent).toBe("none");
    expect(screen.getByTestId("balance").textContent).toBe("none");
    expect(window.localStorage.getItem(AUTOCONNECT_STORAGE_KEY)).toBeNull();
  });

  it("cleans up WatchWalletChanges watcher on unmount", () => {
    const { unmount } = renderWithProviders();
    unmount();
    expect(mocks.mockWatcherStop).toHaveBeenCalled();
  });

  it("handles Freighter not installed gracefully on connect", async () => {
    mocks.mockIsConnected.mockResolvedValue({ isConnected: false });

    renderWithProviders();

    const connectBtn = screen.getByTestId("connect-btn");
    await act(async () => {
      connectBtn.click();
    });

    expect(screen.getByTestId("address").textContent).toBe("none");
  });
});
