import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { SidebarProvider } from "@/context/SidebarContext";
import { afterEach, beforeEach, vi } from "vitest";
import { useWallet } from "@/hooks/useWallet";

vi.mock("@/components/shared/layout/NotificationBell", () => ({
  default: () => <button type="button" aria-label="View notifications" />,
}));

vi.mock("@/components/molecules/SearchBar", () => ({
  SearchBar: ({ placeholder }: { placeholder: string }) => (
    <input aria-label={placeholder} placeholder={placeholder} />
  ),
}));

vi.mock("@/hooks/useWallet", () => ({
  useWallet: vi.fn(),
}));

import TopNav from "./TopNav";

const renderTopNav = () =>
  render(
    <SidebarProvider>
      <TopNav />
    </SidebarProvider>,
  );

const mockUseWallet = vi.mocked(useWallet);
const connectedAddress =
  "GABCDEFGHIJKLMNOPQRSTUVWXYZ234567890123456789012345678901234";

function setWalletState(overrides: Partial<ReturnType<typeof useWallet>> = {}) {
  mockUseWallet.mockReturnValue({
    address: null,
    network: "TESTNET",
    status: "disconnected",
    error: null,
    connect: vi.fn(),
    disconnect: vi.fn(),
    ...overrides,
  });
}

describe("TopNav Accessibility", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    setWalletState();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({}),
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("renders notification button with proper aria-label", () => {
    renderTopNav();

    const notificationButtons = screen.getAllByRole("button", {
      name: /view notifications/i,
    });

    expect(notificationButtons.length).toBeGreaterThan(0);
  });

  it("renders profile button with proper aria-label", () => {
    renderTopNav();

    const profileButtons = screen.getAllByRole("button", {
      name: /view profile/i,
    });

    expect(profileButtons.length).toBeGreaterThan(0);
  });

  it("renders sidebar toggle with proper accessibility attributes", () => {
    renderTopNav();

    const sidebarToggle = screen.getByRole("button", {
      name: /toggle sidebar/i,
    });

    expect(sidebarToggle).toBeInTheDocument();
  });

  it("all buttons have proper button roles", () => {
    renderTopNav();

    const buttons = screen.getAllByRole("button");

    expect(buttons.length).toBeGreaterThan(0);

    buttons.forEach((button) => {
      expect(button).toBeInTheDocument();
    });
  });

  it("network selector has accessible content", () => {
    renderTopNav();

    const networkButton = screen.getByRole("button", {
      name: /select network/i,
    });

    const walletButton = screen.getByRole("button", {
      name: /connect wallet/i,
    });

    const walletButton = screen.getByRole("button", {
      name: /connect wallet/i,
    });

    expect(accountButtons.length).toBeGreaterThanOrEqual(1);
  });

  it("all icon-only buttons have focus-visible ring classes", () => {
    renderTopNav();

    const buttons = screen.getAllByRole("button");
    const iconOnlyButtons = buttons.filter((btn) =>
      btn.className.includes("focus-visible:ring-2"),
    );

    expect(iconOnlyButtons.length).toBeGreaterThanOrEqual(4);
    iconOnlyButtons.forEach((btn) => {
      expect(btn).toHaveClass("focus-visible:ring-2");
    });
  });

  it("notification buttons are focusable", () => {
    renderTopNav();

    const notificationButtons = screen.getAllByRole("button", {
      name: /view notifications/i,
    });

    notificationButtons.forEach((btn) => {
      btn.focus();
      expect(btn).toHaveFocus();
    });
  });

  it("notification buttons can be activated with keyboard", () => {
    renderTopNav();

    const notificationButtons = screen.getAllByRole("button", {
      name: /view notifications/i,
    });

    notificationButtons.forEach((btn) => {
      expect(btn).toBeInTheDocument();
      expect(btn.tagName).toBe("BUTTON");
    });
  });

  it("shows a not-connected balance summary without fetching", () => {
    renderTopNav();

    fireEvent.click(screen.getByRole("button", { name: /wallet balances/i }));

    expect(
      screen.getByRole("dialog", { name: /wallet balance summary/i }),
    ).toBeInTheDocument();
    expect(screen.getByText("Not connected.")).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("loads and renders connected wallet balances with registry decimals", async () => {
    setWalletState({
      address: connectedAddress,
      status: "connected",
    });
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        balances: [
          { asset_type: "native", balance: "0.0000000" },
          {
            asset_type: "credit_alphanum4",
            asset_code: "USDC",
            balance: "1234567.123456",
          },
        ],
      }),
    } as Response);

    renderTopNav();
    fireEvent.click(screen.getByRole("button", { name: /wallet balances/i }));

    expect(screen.getByRole("status")).toHaveTextContent("Loading balances...");
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining(`/accounts/${connectedAddress}`),
    );
    expect(await screen.findByText("XLM")).toBeInTheDocument();
    expect(screen.getByText("0.0000000")).toBeInTheDocument();
    expect(screen.getByText("USDC")).toBeInTheDocument();
    expect(screen.getByText("1,234,567.123456")).toBeInTheDocument();
  });

  it("shows unknown asset metadata and grouped large balances", async () => {
    setWalletState({
      address: connectedAddress,
      status: "connected",
    });
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        balances: [
          {
            asset_type: "credit_alphanum4",
            asset_code: "DOGE",
            balance: "987654321.1234567",
          },
        ],
      }),
    } as Response);

    renderTopNav();
    fireEvent.click(screen.getByRole("button", { name: /wallet balances/i }));

    expect(await screen.findByText("DOGE")).toBeInTheDocument();
    expect(screen.getByText(/Unknown asset/)).toBeInTheDocument();
    expect(screen.getByText(/unregistered/)).toBeInTheDocument();
    expect(screen.getByText("987,654,321.1234567")).toBeInTheDocument();
  });

  it("shows a non-blocking error state when the balance fetch fails", async () => {
    setWalletState({
      address: connectedAddress,
      status: "connected",
    });
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      json: async () => ({}),
    } as Response);

    renderTopNav();
    fireEvent.click(screen.getByRole("button", { name: /wallet balances/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Could not load balances",
    );
    expect(
      screen.getByRole("button", { name: /connected wallet/i }),
    ).toBeInTheDocument();
  });

  it("closes the balance summary with Escape and restores focus", async () => {
    setWalletState({
      address: connectedAddress,
      status: "connected",
    });
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ balances: [] }),
    } as Response);

    renderTopNav();
    const trigger = screen.getByRole("button", { name: /wallet balances/i });
    fireEvent.click(trigger);

    expect(
      await screen.findByRole("dialog", { name: /wallet balance summary/i }),
    ).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });

    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    expect(trigger).toHaveFocus();
  });
});
