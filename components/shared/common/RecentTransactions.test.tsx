import React from "react";
import { render, screen, fireEvent, waitFor } from "@/test/test-utils";
import { vi, describe, it, expect, beforeEach } from "vitest";
import { TRANSACTION_TYPE_OPTIONS } from "@/lib/transactions/filters";

const mockTransactions = vi.fn(({ typeFilter }: { typeFilter?: string }) => (
  <div data-testid="transactions" data-type={typeFilter ?? ""} />
));

vi.mock("./Transaction", () => ({
  Transactions: mockTransactions,
}));

import { RecentTransactions } from "./RecentTransactions";

describe("RecentTransactions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders transaction type filter chips and defaults to All", () => {
    render(<RecentTransactions />);

    expect(screen.getByRole("button", { name: "All" })).toBeInTheDocument();
    TRANSACTION_TYPE_OPTIONS.forEach((option) => {
      expect(screen.getByRole("button", { name: option.label })).toBeInTheDocument();
    });

    expect(screen.getByTestId("transactions")).toHaveAttribute("data-type", "");
  });

  it("forwards selected typeFilter to the Transactions component", async () => {
    render(<RecentTransactions />);

    const lendChip = screen.getByRole("button", { name: "Lend" });
    fireEvent.click(lendChip);

    await waitFor(() => {
      expect(screen.getByTestId("transactions")).toHaveAttribute("data-type", "lend");
    });

    const allChip = screen.getByRole("button", { name: "All" });
    fireEvent.click(allChip);

    await waitFor(() => {
      expect(screen.getByTestId("transactions")).toHaveAttribute("data-type", "");
    });
  });
});
