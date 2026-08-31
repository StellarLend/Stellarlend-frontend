import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import WalletConnectButton from "./WalletConnectButton";
import { useWalletContext, WalletStatus } from "@/context/WalletContext";
import { copyToClipboard } from "@/lib/utils/clipboard";

// Mock the wallet context
vi.mock("@/context/WalletContext", () => ({
  useWalletContext: vi.fn(),
}));

// Mock the clipboard helper
vi.mock("@/lib/utils/clipboard", () => ({
  copyToClipboard: vi.fn().mockResolvedValue({ success: true }),
}));

describe("WalletConnectButton", () => {
  const mockConnect = vi.fn();
  const mockDisconnect = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const setupMockContext = (overrides: {
    address?: string | null;
    status?: WalletStatus;
    error?: string | null;
  } = {}) => {
    vi.mocked(useWalletContext).mockReturnValue({
      address: overrides.address ?? null,
      status: overrides.status ?? "disconnected",
      error: overrides.error ?? null,
      connect: mockConnect,
      disconnect: mockDisconnect,
      network: "TESTNET",
    });
  };

  it("renders the disconnected state by default", () => {
    setupMockContext();
    render(<WalletConnectButton />);

    const button = screen.getByRole("button", { name: /connect wallet/i });
    expect(button).toBeInTheDocument();
    expect(button).not.toBeDisabled();
    expect(button.className).toContain("focus-visible:ring-[#15A350]");
  });

  it("calls connect when clicking the connect button", () => {
    setupMockContext();
    render(<WalletConnectButton />);

    const button = screen.getByRole("button", { name: /connect wallet/i });
    fireEvent.click(button);

    expect(mockConnect).toHaveBeenCalledTimes(1);
  });

  it("renders the connecting state with 'Connecting...' text and disables the button", () => {
    setupMockContext({ status: "connecting" });
    render(<WalletConnectButton />);

    const button = screen.getByRole("button", { name: /connect wallet/i });
    expect(button).toBeInTheDocument();
    expect(button).toBeDisabled();
    expect(button).toHaveTextContent("Connecting...");
  });

  it("renders the connected state with truncated address", () => {
    const fullAddress = "GBRPAME4HFAIMDOM4VES2SO24TEY246NNSUHE4WR37GBTT5CXYABXL7R";
    setupMockContext({
      address: fullAddress,
      status: "connected",
    });
    render(<WalletConnectButton />);

    const button = screen.getByRole("button", { name: /connected wallet/i });
    expect(button).toBeInTheDocument();
    expect(button).toHaveTextContent("GBRPA…XL7R");
  });

  it("toggles the dropdown menu when clicking the connected button", () => {
    const fullAddress = "GBRPAME4HFAIMDOM4VES2SO24TEY246NNSUHE4WR37GBTT5CXYABXL7R";
    setupMockContext({
      address: fullAddress,
      status: "connected",
    });
    render(<WalletConnectButton />);

    expect(screen.queryByRole("button", { name: /disconnect wallet/i })).not.toBeInTheDocument();

    const button = screen.getByRole("button", { name: /connected wallet/i });
    fireEvent.click(button);

    const disconnectBtn = screen.getByRole("button", { name: /disconnect wallet/i });
    const copyBtn = screen.getByRole("button", { name: /copy address/i });
    expect(disconnectBtn).toBeInTheDocument();
    expect(copyBtn).toBeInTheDocument();
  });

  it("calls disconnect and closes dropdown when clicking disconnect", async () => {
    const fullAddress = "GBRPAME4HFAIMDOM4VES2SO24TEY246NNSUHE4WR37GBTT5CXYABXL7R";
    setupMockContext({
      address: fullAddress,
      status: "connected",
    });
    render(<WalletConnectButton />);

    const button = screen.getByRole("button", { name: /connected wallet/i });
    fireEvent.click(button);

    const disconnectBtn = screen.getByRole("button", { name: /disconnect wallet/i });
    fireEvent.click(disconnectBtn);

    expect(mockDisconnect).toHaveBeenCalledTimes(1);
  });

  it("shows 'Address Copied!' feedback on successful copyToClipboard", async () => {
    const fullAddress = "GBRPAME4HFAIMDOM4VES2SO24TEY246NNSUHE4WR37GBTT5CXYABXL7R";
    setupMockContext({
      address: fullAddress,
      status: "connected",
    });
    vi.mocked(copyToClipboard).mockResolvedValue({ success: true });

    render(<WalletConnectButton />);

    const button = screen.getByRole("button", { name: /connected wallet/i });
    fireEvent.click(button);

    const copyBtn = screen.getByRole("button", { name: /copy address/i });
    await act(async () => {
      fireEvent.click(copyBtn);
    });

    expect(copyToClipboard).toHaveBeenCalledWith(fullAddress);
    expect(screen.getByText("Address Copied!")).toBeInTheDocument();
  });

  it("shows error toast when copyToClipboard fails with clipboard_error", async () => {
    const fullAddress = "GBRPAME4HFAIMDOM4VES2SO24TEY246NNSUHE4WR37GBTT5CXYABXL7R";
    setupMockContext({
      address: fullAddress,
      status: "connected",
    });
    vi.mocked(copyToClipboard).mockResolvedValue({
      success: false,
      reason: "clipboard_error",
    });

    render(<WalletConnectButton />);

    const button = screen.getByRole("button", { name: /connected wallet/i });
    fireEvent.click(button);

    const copyBtn = screen.getByRole("button", { name: /copy address/i });
    await act(async () => {
      fireEvent.click(copyBtn);
    });

    expect(copyToClipboard).toHaveBeenCalledWith(fullAddress);
    expect(screen.getByText("Copy Failed")).toBeInTheDocument();
    expect(
      screen.getByText("Clipboard access is unavailable. Try copying the address manually.")
    ).toBeInTheDocument();
  });

  it("shows error toast when copyToClipboard fails with invalid_address", async () => {
    const fullAddress = "INVALIDADDRESS";
    setupMockContext({
      address: fullAddress,
      status: "connected",
    });
    vi.mocked(copyToClipboard).mockResolvedValue({
      success: false,
      reason: "invalid_address",
    });

    render(<WalletConnectButton />);

    const button = screen.getByRole("button", { name: /connected wallet/i });
    fireEvent.click(button);

    const copyBtn = screen.getByRole("button", { name: /copy address/i });
    await act(async () => {
      fireEvent.click(copyBtn);
    });

    expect(copyToClipboard).toHaveBeenCalledWith(fullAddress);
    expect(screen.getByText("Invalid Address")).toBeInTheDocument();
    expect(
      screen.getByText("The wallet address could not be validated before copying.")
    ).toBeInTheDocument();
  });

  it("surfaces connection errors inline without crashing", () => {
    setupMockContext({
      error: "User rejected connection request",
      status: "error",
    });
    render(<WalletConnectButton />);

    const errorMsg = screen.getByTestId("wallet-error");
    expect(errorMsg).toBeInTheDocument();
    expect(errorMsg).toHaveTextContent("User rejected connection request");

    const button = screen.getByRole("button", { name: /connect wallet/i });
    expect(button).toBeInTheDocument();
  });
});
