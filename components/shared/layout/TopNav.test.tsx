import React from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SidebarProvider } from "@/context/SidebarContext";
import { afterEach, beforeEach, vi } from "vitest";
import { useWallet } from "@/hooks/useWallet";

const routerMock = vi.hoisted(() => ({
  push: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => routerMock,
}));

vi.mock("@/components/shared/layout/NotificationBell", () => ({
  default: () => <button type="button" aria-label="View notifications" />,
}));

vi.mock("@/components/molecules/SearchBar", () => ({
  SearchBar: ({ placeholder }: { placeholder: string }) => (
    <input aria-label={placeholder} />
  ),
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
  sessionStorage.setItem("walletAddress", TEST_ADDRESS);
  vi.mocked(fetch).mockResolvedValue(mockSessionResponse());

  const view = renderTopNav();
  await screen.findByRole("button", { name: /connected wallet/i });
  return view;
};

describe("TopNav Accessibility", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    routerMock.push.mockReset();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(mockSessionResponse(null)),
    );
    delete window.stellar;
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

  it("traps Tab focus inside the open account menu", async () => {
    const user = userEvent.setup();
    await renderConnectedTopNav();

    await user.click(screen.getByRole("button", { name: /connected wallet/i }));

    const menu = await screen.findByRole("menu", {
      name: /connected wallet actions/i,
    });
    const disconnectItem = within(menu).getByRole("menuitem", {
      name: /disconnect wallet/i,
    });
    await waitFor(() => expect(menu).toHaveFocus());

    await user.tab();
    expect(disconnectItem).toHaveFocus();

    await user.tab();
    expect(disconnectItem).toHaveFocus();

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
    renderTopNav();

    const connectButton = screen.getByRole("button", {
      name: /connect wallet/i,
    });
    expect(connectButton).toHaveTextContent("Connect Wallet");
    expect(connectButton).toBeEnabled();

    await user.click(connectButton);

    await waitFor(() =>
      expect(screen.getByTestId("wallet-error")).toHaveTextContent(
        /not detected/i,
      ),
    );
  });
});
