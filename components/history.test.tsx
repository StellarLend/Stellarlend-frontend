import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextIntlClientProvider } from "next-intl";
import messages from "@/messages/en.json";
import History from "./history";
import type { LendingEvent } from "@/lib/events";

const mockWallet = vi.hoisted(() => ({
  address: "GA5WUJ54Z23KILLCUOUNAKTPBVZWKMQVO4O6EQ5GHLAERIMLLHNCSKYH" as string | null,
  connect: vi.fn(),
  disconnect: vi.fn(),
}));

vi.mock("@/components/wallet", () => ({
  useWallet: () => ({
    address: mockWallet.address,
    connect: mockWallet.connect,
    disconnect: mockWallet.disconnect,
    balance: "100.00",
    error: null,
  }),
  ConnectButton: () => <button onClick={mockWallet.connect}>Connect</button>,
}));

const mockEvents = vi.hoisted(() => ({
  getLendingEvents: vi.fn(),
}));

vi.mock("@/lib/events", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/events")>();
  return {
    ...actual,
    getLendingEvents: mockEvents.getLendingEvents,
  };
});

const sampleDeposit: LendingEvent = {
  id: "deposit-event-1",
  kind: "deposit",
  user: "GA5WUJ54Z23KILLCUOUNAKTPBVZWKMQVO4O6EQ5GHLAERIMLLHNCSKYH",
  amount: BigInt(50_000_000), // 5 XLM
  after: BigInt(150_000_000), // 15 XLM
  timestamp: 1_700_000_000,
  ledger: 1000,
  txHash: "a".repeat(64),
};

const sampleBorrow: LendingEvent = {
  id: "borrow-event-2",
  kind: "borrow",
  user: "GA5WUJ54Z23KILLCUOUNAKTPBVZWKMQVO4O6EQ5GHLAERIMLLHNCSKYH",
  amount: BigInt(20_000_000), // 2 XLM
  after: BigInt(20_000_000), // 2 XLM
  timestamp: 1_700_000_100,
  ledger: 1005,
  txHash: "b".repeat(64),
};

function renderHistory() {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <History />
    </NextIntlClientProvider>
  );
}

describe("History Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockWallet.address = "GA5WUJ54Z23KILLCUOUNAKTPBVZWKMQVO4O6EQ5GHLAERIMLLHNCSKYH";
    mockEvents.getLendingEvents.mockResolvedValue({
      events: [],
      cursor: "cursor-1",
      hasMore: false,
    });
  });

  afterEach(cleanup);

  it("renders disconnected state when wallet is not connected", async () => {
    mockWallet.address = null;
    renderHistory();

    expect(screen.getByTestId("history-disconnected")).toBeTruthy();
    expect(screen.getByText("Connect wallet to view history")).toBeTruthy();
    expect(
      screen.getByText("Please connect your Stellar wallet to view your on-chain transaction history.")
    ).toBeTruthy();

    const connectBtn = screen.getByRole("button", { name: "Connect wallet" });
    fireEvent.click(connectBtn);
    expect(mockWallet.connect).toHaveBeenCalled();
  });

  it("renders loading state while events are fetching", async () => {
    let resolvePromise: (value: any) => void;
    const promise = new Promise((resolve) => {
      resolvePromise = resolve;
    });
    mockEvents.getLendingEvents.mockReturnValue(promise);

    renderHistory();

    expect(screen.getByTestId("history-loading")).toBeTruthy();
    expect(screen.getByText("Loading transaction history...")).toBeTruthy();

    resolvePromise!({ events: [], cursor: "", hasMore: false });
    await waitFor(() => {
      expect(screen.queryByTestId("history-loading")).toBeNull();
    });
  });

  it("renders empty state with RPC retention notice when no events exist", async () => {
    mockEvents.getLendingEvents.mockResolvedValue({
      events: [],
      cursor: "cur",
      hasMore: false,
    });

    renderHistory();

    expect(await screen.findByTestId("history-empty")).toBeTruthy();
    expect(screen.getByText("No transactions found")).toBeTruthy();
    expect(
      screen.getByText(/No transactions found for your address within the RPC retention window/)
    ).toBeTruthy();
  });

  it("renders populated table and handles pagination with load more", async () => {
    mockEvents.getLendingEvents
      .mockResolvedValueOnce({
        events: [sampleDeposit],
        cursor: "cursor-page-1",
        hasMore: true,
      })
      .mockResolvedValueOnce({
        events: [sampleBorrow],
        cursor: "cursor-page-2",
        hasMore: false,
      });

    renderHistory();

    expect(await screen.findByTestId("history-populated")).toBeTruthy();
    expect(screen.getByText("Deposit")).toBeTruthy();
    expect(screen.getByText("5 XLM")).toBeTruthy();
    expect(screen.getByText("15 XLM")).toBeTruthy();

    // Verify explorer link
    const links = screen.getAllByRole("link", { name: "View" });
    expect(links[0].getAttribute("href")).toContain(sampleDeposit.txHash);

    // Verify Load More
    const loadMoreBtn = screen.getByRole("button", { name: "Load more" });
    expect(loadMoreBtn).toBeTruthy();

    fireEvent.click(loadMoreBtn);

    await waitFor(() => {
      expect(mockEvents.getLendingEvents).toHaveBeenCalledWith(
        expect.objectContaining({ cursor: "cursor-page-1" })
      );
    });

    expect(await screen.findByText("Borrow")).toBeTruthy();
    expect(screen.getAllByText("2 XLM").length).toBeGreaterThanOrEqual(1);
  });

  it("renders RPC error state with retry button", async () => {
    mockEvents.getLendingEvents.mockRejectedValueOnce(
      new Error("Soroban RPC server unavailable")
    );

    renderHistory();

    expect(await screen.findByTestId("history-error")).toBeTruthy();
    expect(screen.getByText("Failed to load transaction history")).toBeTruthy();
    expect(screen.getByText("Soroban RPC server unavailable")).toBeTruthy();

    // Clicking retry calls getLendingEvents again
    mockEvents.getLendingEvents.mockResolvedValueOnce({
      events: [sampleDeposit],
      cursor: "",
      hasMore: false,
    });

    const retryBtn = screen.getByRole("button", { name: "Try again" });
    fireEvent.click(retryBtn);

    expect(await screen.findByTestId("history-populated")).toBeTruthy();
    expect(screen.getByText("Deposit")).toBeTruthy();
  });
});
