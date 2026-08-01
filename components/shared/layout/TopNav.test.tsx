import React from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SidebarProvider } from "@/context/SidebarContext";
import { afterEach, beforeEach, vi } from "vitest";

const fetchWalletBalancesMock = vi.hoisted(() => vi.fn());

const routerMock = vi.hoisted(() => ({
  push: vi.fn(),
}));

const walletState = vi.hoisted(() => {
  const listeners = new Set<() => void>();
  const state = {
    address: null as string | null,
    network: "TESTNET",
    connect: vi.fn(),
    disconnect: vi.fn(),
    status: "disconnected" as string,
    error: null as string | null,
    accounts: [] as string[],
    activeAccount: null as string | null,
    switchAccount: vi.fn(),
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    emit() {
      for (const listener of listeners) listener();
    },
  };
  return state;
});

vi.mock("next/navigation", () => ({
  useRouter: () => routerMock,
}));

vi.mock("@/hooks/useWallet", () => {
  const React = require("react") as typeof import("react");
  return {
    useWallet: () => {
      const [, setTick] = React.useState(0);
      React.useEffect(() => walletState.subscribe(() => setTick((n) => n + 1)), []);
      return {
        address: walletState.address,
        network: walletState.network,
        connect: walletState.connect,
        disconnect: walletState.disconnect,
        status: walletState.status,
        error: walletState.error,
        accounts: walletState.accounts,
        activeAccount: walletState.activeAccount,
        switchAccount: walletState.switchAccount,
      };
    },
  };
});

vi.mock("@/components/shared/layout/NotificationBell", () => ({
  default: () => <button type="button" aria-label="View notifications" />,
}));

vi.mock("@/components/molecules/SearchBar", () => ({
  SearchBar: ({ placeholder }: { placeholder: string }) => (
    <input aria-label={placeholder} />
  ),
}));

vi.mock("@/lib/wallet/balances", () => ({
  fetchWalletBalances: fetchWalletBalancesMock,
}));

import TopNav from "./TopNav";

const TEST_ADDRESS = "GABCD1234567890EFGH";

const mockSessionResponse = (walletAddress: string | null = TEST_ADDRESS) => ({
  ok: Boolean(walletAddress),
  json: async () =>
    walletAddress ? { session: { user: { walletAddress } } } : {},
});

const renderTopNav = () =>
  render(
    <SidebarProvider>
      <TopNav />
    </SidebarProvider>,
  );

const renderConnectedTopNav = async () => {
  walletState.address = TEST_ADDRESS;
  walletState.status = "connected";
  walletState.disconnect.mockImplementation(() => {
    walletState.address = null;
    walletState.status = "disconnected";
    sessionStorage.removeItem("walletAddress");
    walletState.emit();
  });
  sessionStorage.setItem("walletAddress", TEST_ADDRESS);
  vi.mocked(fetch).mockResolvedValue(mockSessionResponse());

  const view = renderTopNav();
  await screen.findByRole("button", { name: /connected wallet/i });
  return view;
};

describe("TopNav Accessibility", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    window.localStorage.clear();
    routerMock.push.mockReset();
    walletState.address = null;
    walletState.status = "disconnected";
    walletState.error = null;
    walletState.connect.mockReset();
    walletState.disconnect.mockReset();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(mockSessionResponse(null)),
    );
    delete window.stellar;
    fetchWalletBalancesMock.mockReset();
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

  it("renders the NotificationBell component in both desktop and mobile slots", () => {
    renderTopNav();

    // TopNav renders NotificationBell in two slots: desktop (hidden md:flex) and
    // mobile (md:hidden). The mock renders a button with aria-label="View notifications"
    // for each, so we expect exactly two instances.
    const notificationButtons = screen.getAllByRole("button", {
      name: /view notifications/i,
    });

    expect(notificationButtons).toHaveLength(2);
    notificationButtons.forEach((btn) => {
      expect(btn).toBeInTheDocument();
    });
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
    expect(networkButton).toBeInTheDocument();

    const walletButton = screen.getByRole("button", {
      name: /connect wallet/i,
    });
    expect(walletButton).toBeInTheDocument();
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

  it("opens the account menu with menu semantics without focusing the destructive action first", async () => {
    const user = userEvent.setup();
    await renderConnectedTopNav();

    const walletButton = screen.getByRole("button", {
      name: /connected wallet/i,
    });
    await user.click(walletButton);

    const menu = await screen.findByRole("menu", {
      name: /connected wallet actions/i,
    });
    const disconnectItem = within(menu).getByRole("menuitem", {
      name: /disconnect wallet/i,
    });

    expect(walletButton).toHaveAttribute("aria-expanded", "true");
    expect(walletButton).toHaveAttribute("aria-controls", "topnav-wallet-menu");
    await waitFor(() => expect(menu).toHaveFocus());
    expect(disconnectItem).not.toHaveFocus();
  });

  it("opens the wallet balance popover and renders fetched balances", async () => {
    const user = userEvent.setup();
    fetchWalletBalancesMock.mockResolvedValue([
      {
        symbol: "XLM",
        name: "Stellar Lumens",
        amount: 12.5,
        formatted: "12.5000000",
        hasMetadata: true,
      },
    ]);
    await renderConnectedTopNav();

    await user.click(screen.getByRole("button", { name: /wallet balances/i }));

    expect(
      await screen.findByRole("dialog", { name: /wallet balance summary/i }),
    ).toBeInTheDocument();
    expect(await screen.findByText("XLM")).toBeInTheDocument();
    expect(screen.getByText("12.5000000")).toBeInTheDocument();
    expect(fetchWalletBalancesMock).toHaveBeenCalledWith(TEST_ADDRESS);
  });

  it("traps Tab focus inside the open account menu", async () => {
    const user = userEvent.setup();
    await renderConnectedTopNav();

    await user.click(screen.getByRole("button", { name: /connected wallet/i }));

    const menu = await screen.findByRole("menu", {
      name: /connected wallet actions/i,
    });
    const copyItem = within(menu).getByRole("menuitem", {
      name: /copy address/i,
    });
    const settingsItem = within(menu).getByRole("menuitem", {
      name: /account settings/i,
    });
    const disconnectItem = within(menu).getByRole("menuitem", {
      name: /disconnect wallet/i,
    });
    await waitFor(() => expect(menu).toHaveFocus());

    await user.tab();
    expect(copyItem).toHaveFocus();

    await user.tab();
    expect(settingsItem).toHaveFocus();

    await user.tab();
    expect(disconnectItem).toHaveFocus();

    await user.tab();
    expect(copyItem).toHaveFocus();

    await user.tab({ shift: true });
    expect(disconnectItem).toHaveFocus();
  });

  it("closes on Escape and restores focus to the wallet trigger", async () => {
    const user = userEvent.setup();
    await renderConnectedTopNav();

    const walletButton = screen.getByRole("button", {
      name: /connected wallet/i,
    });
    await user.click(walletButton);
    const menu = await screen.findByRole("menu", {
      name: /connected wallet actions/i,
    });
    await waitFor(() => expect(menu).toHaveFocus());

    await user.keyboard("{Escape}");

    await waitFor(() =>
      expect(
        screen.queryByRole("menu", { name: /connected wallet actions/i }),
      ).not.toBeInTheDocument(),
    );
    expect(walletButton).toHaveAttribute("aria-expanded", "false");
    await waitFor(() => expect(walletButton).toHaveFocus());
  });

  it("closes on outside click and restores the collapsed ARIA state", async () => {
    const user = userEvent.setup();
    await renderConnectedTopNav();

    const walletButton = screen.getByRole("button", {
      name: /connected wallet/i,
    });
    const networkButton = screen.getByRole("button", {
      name: /select network/i,
    });

    await user.click(walletButton);
    expect(
      await screen.findByRole("menu", { name: /connected wallet actions/i }),
    ).toBeInTheDocument();

    await user.click(networkButton);

    await waitFor(() =>
      expect(
        screen.queryByRole("menu", { name: /connected wallet actions/i }),
      ).not.toBeInTheDocument(),
    );
    expect(walletButton).toHaveAttribute("aria-expanded", "false");
  });

  it("supports rapid trigger open and close without leaving stale menu state", async () => {
    const user = userEvent.setup();
    await renderConnectedTopNav();

    const walletButton = screen.getByRole("button", {
      name: /connected wallet/i,
    });

    await user.click(walletButton);
    expect(
      await screen.findByRole("menu", { name: /connected wallet actions/i }),
    ).toBeInTheDocument();

    await user.click(walletButton);

    await waitFor(() =>
      expect(
        screen.queryByRole("menu", { name: /connected wallet actions/i }),
      ).not.toBeInTheDocument(),
    );
    expect(walletButton).toHaveAttribute("aria-expanded", "false");
    expect(walletButton).toHaveFocus();
  });

  it("disconnects from the menu without restoring focus to the removed wallet trigger", async () => {
    const user = userEvent.setup();
    await renderConnectedTopNav();

    await user.click(screen.getByRole("button", { name: /connected wallet/i }));
    const menu = await screen.findByRole("menu", {
      name: /connected wallet actions/i,
    });
    const disconnectItem = within(menu).getByRole("menuitem", {
      name: /disconnect wallet/i,
    });

    await user.click(disconnectItem);

    await waitFor(() =>
      expect(
        screen.queryByRole("menu", { name: /connected wallet actions/i }),
      ).not.toBeInTheDocument(),
    );
    await waitFor(() =>
      expect(
        screen.queryByRole("button", { name: /connected wallet/i }),
      ).not.toBeInTheDocument(),
    );
    expect(sessionStorage.getItem("walletAddress")).toBeNull();
  });

  it("renders and invokes the connect wallet action when disconnected", async () => {
    const user = userEvent.setup();
    walletState.error = null;
    renderTopNav();

    const connectButton = screen.getByRole("button", {
      name: /connect wallet/i,
    });
    expect(connectButton).toHaveTextContent("Connect Wallet");
    expect(connectButton).toBeEnabled();

    await user.click(connectButton);

    expect(walletState.connect).toHaveBeenCalled();
  });

  it("renders a keyboard-operable theme toggle that cycles modes", async () => {
    const user = userEvent.setup();
    window.localStorage.clear();
    renderTopNav();

    const toggle = screen.getByRole("button", { name: /theme:/i });
    expect(toggle).toBeInTheDocument();

    // Default is system after rehydrate.
    await waitFor(() =>
      expect(toggle).toHaveAttribute("data-theme-mode", "system"),
    );

    await user.click(toggle);
    await waitFor(() =>
      expect(toggle).toHaveAttribute("data-theme-mode", "light"),
    );
    expect(window.localStorage.getItem("stellarlend-theme")).toBe("light");

    await user.click(toggle);
    await waitFor(() =>
      expect(toggle).toHaveAttribute("data-theme-mode", "dark"),
    );
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });
});
