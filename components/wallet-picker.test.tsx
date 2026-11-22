import { render, screen, act } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import React from "react";
import { WalletPickerModal } from "./wallet-picker";

// Mock next-intl
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => {
    const messages: Record<string, string> = {
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

// Mock SUPPORTED_WALLETS
vi.mock("@/lib/wallets", () => ({
  SUPPORTED_WALLETS: [
    {
      id: "freighter",
      name: "Freighter",
      icon: "freighter.svg",
      installUrl: "https://freighter.app",
      loadAdapter: async () => ({
        id: "freighter",
        name: "Freighter",
        icon: "freighter.svg",
        isAvailable: async () => true,
        connect: async () => "GBF...",
        signTransaction: async () => "",
        disconnect: async () => {},
      }),
    },
    {
      id: "xbull",
      name: "xBull",
      icon: "xbull.svg",
      installUrl: "https://xbull.app",
      loadAdapter: async () => ({
        id: "xbull",
        name: "xBull",
        icon: "xbull.svg",
        isAvailable: async () => false,
        connect: async () => "GBX...",
        signTransaction: async () => "",
        disconnect: async () => {},
      }),
    },
  ],
}));

describe("WalletPickerModal", () => {
  it("renders modal when open with available and unavailable wallets", async () => {
    render(
      <WalletPickerModal
        isOpen={true}
        onClose={vi.fn()}
        onSelectWallet={vi.fn()}
        lastWalletId="freighter"
      />
    );

    expect(screen.getByRole("dialog")).toBeDefined();
    expect(screen.getByText("Connect a Wallet")).toBeDefined();

    // Wait for availability promises to resolve
    const availableLabel = await screen.findByText("Available");
    expect(availableLabel).toBeDefined();

    const notInstalledLabel = await screen.findByText("Not installed");
    expect(notInstalledLabel).toBeDefined();

    // Check Recent badge
    expect(screen.getByText("Recent")).toBeDefined();

    // Check Install link for unavailable wallet
    const installLink = screen.getByText("Install");
    expect(installLink.getAttribute("href")).toBe("https://xbull.app");
  });

  it("calls onClose when Esc key is pressed", async () => {
    const onClose = vi.fn();
    render(
      <WalletPickerModal
        isOpen={true}
        onClose={onClose}
        onSelectWallet={vi.fn()}
      />
    );

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("handles wallet selection", async () => {
    const onSelect = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();

    render(
      <WalletPickerModal
        isOpen={true}
        onClose={onClose}
        onSelectWallet={onSelect}
      />
    );

    const freighterBtn = await screen.findByRole("button", { name: /Freighter/i });
    await act(async () => {
      freighterBtn.click();
    });

    expect(onSelect).toHaveBeenCalledWith("freighter");
    expect(onClose).toHaveBeenCalled();
  });
});
