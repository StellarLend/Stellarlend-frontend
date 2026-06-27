import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";
import { AccountMenu } from "./AccountMenu";
import { useWallet } from "@/hooks/useWallet";
import { copyToClipboard } from "@/lib/utils/clipboard";

vi.mock("@/hooks/useWallet", () => ({
  useWallet: vi.fn(),
}));

vi.mock("@/lib/utils/clipboard", () => ({
  copyToClipboard: vi.fn(),
}));

vi.mock("next/link", () => {
  const MockLink = ({ children, href, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  );
  MockLink.displayName = "MockLink";
  return { default: MockLink };
});

const mockUseWallet = vi.mocked(useWallet);
const mockCopyToClipboard = vi.mocked(copyToClipboard);

const baseWalletState = {
  walletAddress: "GABCQZ2Q6YPRB5T2Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5A",
  loading: false,
  error: null,
  connect: vi.fn(),
  disconnect: vi.fn(),
};

beforeEach(() => {
  vi.resetAllMocks();
  mockUseWallet.mockReturnValue(baseWalletState as any);
  mockCopyToClipboard.mockResolvedValue({ success: true });
});

describe("AccountMenu", () => {
  it("renders connected wallet trigger with truncated address", () => {
    render(<AccountMenu />);

    const trigger = screen.getByRole("button", { name: /account menu/i });
    expect(trigger).toBeInTheDocument();
    expect(trigger).toHaveTextContent("GABCQ...5Z5A");
  });

  it("opens dropdown when trigger is clicked", async () => {
    render(<AccountMenu />);

    const trigger = screen.getByRole("button", { name: /account menu/i });
    fireEvent.click(trigger);

    await waitFor(() => {
      expect(screen.getByRole("menu", { name: /account options/i })).toBeInTheDocument();
    });

    expect(screen.getByText("Copy Address")).toBeInTheDocument();
    expect(screen.getByText("Account Settings")).toBeInTheDocument();
    expect(screen.getByText("Disconnect")).toBeInTheDocument();
  });

  it("closes dropdown when Escape is pressed", async () => {
    render(<AccountMenu />);

    const trigger = screen.getByRole("button", { name: /account menu/i });
    fireEvent.click(trigger);

    await waitFor(() => {
      expect(screen.getByRole("menu")).toBeInTheDocument();
    });

    fireEvent.keyDown(document, { key: "Escape" });

    await waitFor(() => {
      expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    });

    expect(trigger).toHaveFocus();
  });

  it("copies address to clipboard when Copy Address is clicked", async () => {
    render(<AccountMenu />);

    const trigger = screen.getByRole("button", { name: /account menu/i });
    fireEvent.click(trigger);

    await waitFor(() => {
      expect(screen.getByRole("menu")).toBeInTheDocument();
    });

    const copyButton = screen.getByRole("menuitem", { name: /copy address/i });
    fireEvent.click(copyButton);

    expect(mockCopyToClipboard).toHaveBeenCalledWith(
      "GABCQZ2Q6YPRB5T2Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5A",
      true,
    );

    await waitFor(() => {
      expect(screen.getByText("Copied")).toBeInTheDocument();
    });
  });

  it("shows error state on clipboard failure", async () => {
    mockCopyToClipboard.mockResolvedValueOnce({
      success: false,
      reason: "clipboard_error",
    });

    render(<AccountMenu />);

    const trigger = screen.getByRole("button", { name: /account menu/i });
    fireEvent.click(trigger);

    await waitFor(() => {
      expect(screen.getByRole("menu")).toBeInTheDocument();
    });

    const copyButton = screen.getByRole("menuitem", { name: /copy address/i });
    fireEvent.click(copyButton);

    await waitFor(() => {
      expect(screen.getByText("Copy failed")).toBeInTheDocument();
    });
  });

  it("calls disconnect when Disconnect is clicked", async () => {
    const mockDisconnect = vi.fn().mockResolvedValue(undefined);
    mockUseWallet.mockImplementation(() => ({
      ...baseWalletState,
      disconnect: mockDisconnect,
    }));

    render(<AccountMenu />);

    const trigger = screen.getByRole("button", { name: /account menu/i });
    fireEvent.click(trigger);

    await waitFor(() => {
      expect(screen.getByRole("menu")).toBeInTheDocument();
    });

    const disconnectButton = screen.getByRole("menuitem", { name: /disconnect/i });
    fireEvent.click(disconnectButton);

    await waitFor(() => {
      expect(mockDisconnect).toHaveBeenCalledTimes(1);
    });
  });

  it("navigates to account settings when link is clicked", async () => {
    render(<AccountMenu />);

    const trigger = screen.getByRole("button", { name: /account menu/i });
    fireEvent.click(trigger);

    await waitFor(() => {
      expect(screen.getByRole("menu")).toBeInTheDocument();
    });

    const settingsLink = screen.getByRole("menuitem", { name: /account settings/i });
    expect(settingsLink).toHaveAttribute("href", "/account/profile");
  });

  it("shows Connect Wallet button when disconnected", () => {
    mockUseWallet.mockReturnValueOnce({
      ...baseWalletState,
      walletAddress: null,
    } as any);

    render(<AccountMenu />);

    const connectButton = screen.getByRole("button", { name: /connect wallet/i });
    expect(connectButton).toBeInTheDocument();
    expect(connectButton).toHaveTextContent("Connect Wallet");
  });

  it("calls connect when Connect Wallet is clicked while disconnected", () => {
    const mockConnect = vi.fn();
    mockUseWallet.mockReturnValueOnce({
      ...baseWalletState,
      walletAddress: null,
      connect: mockConnect,
    } as any);

    render(<AccountMenu />);

    const connectButton = screen.getByRole("button", { name: /connect wallet/i });
    fireEvent.click(connectButton);

    expect(mockConnect).toHaveBeenCalledTimes(1);
  });

  it("shows Connecting... text when loading", () => {
    mockUseWallet.mockReturnValueOnce({
      ...baseWalletState,
      walletAddress: null,
      loading: true,
    } as any);

    render(<AccountMenu />);

    const connectButton = screen.getByRole("button", { name: /connect wallet/i });
    expect(connectButton).toHaveTextContent("Connecting...");
    expect(connectButton).toBeDisabled();
  });

  it("closes menu when clicking outside", async () => {
    render(
      <div>
        <AccountMenu />
        <button>Outside</button>
      </div>
    );

    const trigger = screen.getByRole("button", { name: /account menu/i });
    fireEvent.click(trigger);

    await waitFor(() => {
      expect(screen.getByRole("menu")).toBeInTheDocument();
    });

    fireEvent.mouseDown(screen.getByText("Outside"));

    await waitFor(() => {
      expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    });
  });

  it("shows error message when present", () => {
    mockUseWallet.mockReturnValueOnce({
      ...baseWalletState,
      error: "Connection failed",
    } as any);

    render(<AccountMenu />);

    expect(screen.getByTestId("wallet-error")).toHaveTextContent("Connection failed");
  });

  it("focuses first menu item when opening with ArrowDown", async () => {
    render(<AccountMenu />);

    const trigger = screen.getByRole("button", { name: /account menu/i });
    trigger.focus();
    fireEvent.keyDown(trigger, { key: "ArrowDown" });

    await waitFor(() => {
      expect(screen.getByRole("menu")).toBeInTheDocument();
    });

    const copyItem = screen.getByRole("menuitem", { name: /copy address/i });
    expect(copyItem).toHaveFocus();
  });
});
