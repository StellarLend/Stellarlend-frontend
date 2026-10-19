import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextIntlClientProvider } from "next-intl";
import messages from "@/messages/en.json";
import FlashLoansPage from "./flash-loans";
import type { FlashActivity } from "@/lib/flash-events";

const FlashLoans = () => (
  <NextIntlClientProvider locale="en" messages={messages}>
    <FlashLoansPage />
  </NextIntlClientProvider>
);

const mockEvents = vi.hoisted(() => ({
  fetchFlashEvents: vi.fn(),
  fetchFlashLoanParams: vi.fn(),
}));

vi.mock("@/lib/flash-events", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/flash-events")>();
  return {
    ...actual,
    fetchFlashEvents: mockEvents.fetchFlashEvents,
    fetchFlashLoanParams: mockEvents.fetchFlashLoanParams,
  };
});

const loan: FlashActivity = {
  id: "loan-event",
  kind: "loan",
  initiator: "GAAAAA...initiator",
  receiver: "CBBBBB...receiver",
  asset: "CAAAAA...asset",
  amount: BigInt(123_450_000),
  fee: BigInt(61_725),
  feeBps: "5",
  ledger: 1234,
  transactionIndex: 1,
  operationIndex: 0,
  timestamp: "2024-01-01T00:00:00.000Z",
  txHash: "b".repeat(64),
};

beforeEach(() => {
  vi.clearAllMocks();
  mockEvents.fetchFlashEvents.mockResolvedValue({
    events: [],
    cursor: "cursor-one",
    hasMore: false,
  });
  mockEvents.fetchFlashLoanParams.mockResolvedValue({ maxFlashBps: BigInt(2_500), paused: false });
});

afterEach(cleanup);

describe("FlashLoans", () => {
  it("shows an explanatory empty state", async () => {
    render(<FlashLoans />);

    expect(await screen.findByText("No flash-loan activity found")).toBeTruthy();
    expect(screen.getByText(/RPC only retains a limited window/)).toBeTruthy();
  });

  it("shows populated activity and the on-chain parameter values", async () => {
    mockEvents.fetchFlashEvents.mockResolvedValue({
      events: [loan],
      cursor: "cursor-one",
      hasMore: false,
    });

    render(<FlashLoans />);

    expect(await screen.findByText("Flash loan")).toBeTruthy();
    expect(screen.getByText("25%")).toBeTruthy();
    expect(screen.getByText("5 bps")).toBeTruthy();
    expect(screen.getByText("Active")).toBeTruthy();
    expect(screen.getByText("12.345")).toBeTruthy();
  });

  it("shows the paused state returned by the contract", async () => {
    mockEvents.fetchFlashLoanParams.mockResolvedValue({ maxFlashBps: BigInt(5_000), paused: true });
    render(<FlashLoans />);

    expect(await screen.findByText("Paused")).toBeTruthy();
    expect(screen.getByText("50%")).toBeTruthy();
  });

  it("deduplicates events returned on consecutive cursor pages", async () => {
    mockEvents.fetchFlashEvents
      .mockResolvedValueOnce({ events: [loan], cursor: "cursor-one", hasMore: true })
      .mockResolvedValueOnce({ events: [loan, { ...loan, id: "second-event", ledger: 1235 }], cursor: "cursor-two", hasMore: false });

    render(<FlashLoans />);
    await screen.findByText("Flash loan");
    fireEvent.click(screen.getByRole("button", { name: "Load next events" }));

    await waitFor(() => expect(mockEvents.fetchFlashEvents).toHaveBeenCalledWith("cursor-one"));
    await waitFor(() => expect(screen.getAllByText("Flash loan")).toHaveLength(2));
  });
});
