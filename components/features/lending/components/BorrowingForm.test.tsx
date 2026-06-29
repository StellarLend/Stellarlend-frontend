import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@/test/test-utils";
import BorrowingForm from "./BorrowingForm";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/hooks/useWalletConnection", () => ({
  useWalletConnection: () => ({
    walletAddress: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
    isConnected: true,
    isLoading: false,
    error: null,
    connect: vi.fn(),
    disconnect: vi.fn(),
  }),
}));

describe("BorrowingForm Component", () => {
  const mockInitialData = {
    asset: "USDC",
    amount: 0,
    collateral: "XLM",
    collateralAmount: 0,
    duration: 30,
  };
  const mockOnSubmit = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    mockOnSubmit.mockClear();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = input.toString();

        if (url.includes("/api/auth/session")) {
          return {
            ok: true,
            json: async () => ({
              session: {
                user: {
                  walletAddress:
                    "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
                },
              },
            }),
          } as Response;
        }

        return {
          ok: true,
          json: async () => ({
            prices: {
              XLM: 0.12,
              USDC: 1,
              BTC: 65000,
              ETH: 3500,
            },
          }),
        } as Response;
      }),
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("renders correctly", () => {
    render(
      <BorrowingForm initialData={mockInitialData} onSubmit={mockOnSubmit} />,
    );

    expect(screen.getByText(/Borrow Against Collateral/i)).toBeInTheDocument();
  });

  it("calculates required collateral", async () => {
    render(
      <BorrowingForm initialData={mockInitialData} onSubmit={mockOnSubmit} />,
    );

    const amountInput = screen.getByLabelText(/Amount to Borrow/i);
    fireEvent.change(amountInput, { target: { value: "100" } });

    // 100 USDC at $1 requires 1,250 XLM at $0.12 for 150% coverage.
    expect(screen.getByText("1,250 XLM")).toBeInTheDocument();
  });

  it("shows projected health preview from collateral and price data", async () => {
    render(
      <BorrowingForm initialData={mockInitialData} onSubmit={mockOnSubmit} />,
    );

    fireEvent.change(screen.getByLabelText(/Amount to Borrow/i), {
      target: { value: "100" },
    });

    expect(screen.getByText(/Projected Health Preview/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Health factor/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/At Risk/i)).toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(300);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(fetch).toHaveBeenCalledWith(
      "/api/prices?assets=USDC,XLM",
      expect.objectContaining({
        signal: expect.any(AbortSignal),
      }),
    );
  });

  it("updates the projected band when collateral amount changes", () => {
    render(
      <BorrowingForm
        initialData={{
          ...mockInitialData,
          amount: 100,
          collateral: "USDC",
          collateralAmount: 300,
        }}
        onSubmit={mockOnSubmit}
      />,
    );

    expect(screen.getByText(/Healthy/i)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Collateral Amount/i), {
      target: { value: "120" },
    });

    expect(screen.getByText(/At Risk/i)).toBeInTheDocument();
  });

  it("validates insufficient collateral balance", async () => {
    render(
      <BorrowingForm initialData={mockInitialData} onSubmit={mockOnSubmit} />,
    );

    const amountInput = screen.getByLabelText(/Amount to Borrow/i);
    fireEvent.change(amountInput, { target: { value: "5000" } }); // 150% is 7500, balance is 3750

    const submitButton = screen.getByText(/Review Loan Request/i);
    fireEvent.click(submitButton);

    expect(
      screen.getByText(/Insufficient collateral balance/i),
    ).toBeInTheDocument();
    // Verify our new top-level error banner
    expect(
      screen.getByText(/Please fix the errors in the form before continuing/i),
    ).toBeInTheDocument();
  });

  it("submits successfully with valid data", async () => {
    render(
      <BorrowingForm initialData={mockInitialData} onSubmit={mockOnSubmit} />,
    );

    fireEvent.change(screen.getByLabelText(/Amount to Borrow/i), {
      target: { value: "10" },
    });

    const submitButton = screen.getByText(/Review Loan Request/i);
    fireEvent.click(submitButton);

    // Fast-forward through the 800ms simulated loading delay
    await act(async () => {
      vi.advanceTimersByTime(1000);
      await Promise.resolve();
    });

    // Verify our new success banner
    expect(
      screen.getByText(/Details validated successfully/i),
    ).toBeInTheDocument();
    expect(mockOnSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 10,
        collateral: "XLM",
      }),
    );
  });

  describe("cross-asset collateral", () => {
    it("uses AssetSelector for a distinct collateral asset", () => {
      render(
        <BorrowingForm
          initialData={{ ...mockInitialData, amount: 100 }}
          onSubmit={mockOnSubmit}
        />,
      );

      const selector = screen.getByRole("button", {
        name: "Collateral Asset",
      });
      fireEvent.click(selector);
      fireEvent.click(screen.getByRole("option", { name: /Bitcoin/i }));

      expect(selector).toHaveTextContent("BTC");
      expect(screen.getByText(/Minimum required:/i)).toHaveTextContent("BTC");
    });

    it("allows the same borrow and collateral asset when adequately covered", async () => {
      render(
        <BorrowingForm
          initialData={{
            ...mockInitialData,
            amount: 100,
            collateral: "USDC",
            collateralAmount: 150,
          }}
          onSubmit={mockOnSubmit}
        />,
      );

      fireEvent.click(
        screen.getByRole("button", { name: /Review Loan Request/i }),
      );
      await act(async () => {
        vi.advanceTimersByTime(1000);
        await Promise.resolve();
      });

      expect(mockOnSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          asset: "USDC",
          collateral: "USDC",
          collateralAmount: 150,
        }),
      );
    });

    it("blocks submission with zero collateral", async () => {
      render(
        <BorrowingForm
          initialData={{ ...mockInitialData, amount: 100 }}
          onSubmit={mockOnSubmit}
        />,
      );

      fireEvent.change(screen.getByLabelText(/Collateral Amount/i), {
        target: { value: "" },
      });
      fireEvent.click(
        screen.getByRole("button", { name: /Review Loan Request/i }),
      );

      expect(
        screen.getByText(/Please enter a collateral amount/i),
      ).toBeInTheDocument();
      expect(mockOnSubmit).not.toHaveBeenCalled();
    });

    it("blocks submission when the collateral price is missing", async () => {
      vi.mocked(fetch).mockImplementation(async (input: RequestInfo | URL) => {
        const url = input.toString();

        if (url.includes("/api/auth/session")) {
          return {
            ok: true,
            json: async () => ({
              session: {
                user: {
                  walletAddress:
                    "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
                },
              },
            }),
          } as Response;
        }

        return {
          ok: true,
          json: async () => ({ prices: { USDC: 1 } }),
        } as Response;
      });

      render(
        <BorrowingForm
          initialData={{
            ...mockInitialData,
            amount: 100,
            collateralAmount: 1250,
          }}
          onSubmit={mockOnSubmit}
        />,
      );

      await act(async () => {
        vi.advanceTimersByTime(300);
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(
        screen.getByText(/current price is unavailable for this asset pair/i),
      ).toBeInTheDocument();

      fireEvent.click(
        screen.getByRole("button", { name: /Review Loan Request/i }),
      );

      expect(
        screen.getByText(/current price is required for both assets/i),
      ).toBeInTheDocument();
      expect(mockOnSubmit).not.toHaveBeenCalled();
    });

    it("blocks an undercollateralised submit attempt", () => {
      render(
        <BorrowingForm
          initialData={{
            ...mockInitialData,
            amount: 100,
            collateralAmount: 1000,
          }}
          onSubmit={mockOnSubmit}
        />,
      );

      fireEvent.click(
        screen.getByRole("button", { name: /Review Loan Request/i }),
      );

      expect(
        screen.getByText(/at least 150% of the borrowed value/i),
      ).toBeInTheDocument();
      expect(mockOnSubmit).not.toHaveBeenCalled();
    });
  });

  describe("target health collateral shortcut", () => {
    it("applies a preset target health collateral amount", () => {
      render(
        <BorrowingForm
          initialData={{ ...mockInitialData, amount: 100 }}
          onSubmit={mockOnSubmit}
        />,
      );

      expect(screen.getByText("2,000 XLM")).toBeInTheDocument();
      expect(screen.getByText("750 XLM")).toBeInTheDocument();

      fireEvent.click(
        screen.getByRole("button", { name: /Apply Suggested Collateral/i }),
      );

      expect(screen.getByLabelText(/Collateral Amount/i)).toHaveValue("2,000");
    });

    it("updates the suggestion from a custom target health factor", () => {
      render(
        <BorrowingForm
          initialData={{ ...mockInitialData, amount: 100 }}
          onSubmit={mockOnSubmit}
        />,
      );

      fireEvent.click(
        screen.getByRole("button", { name: /Use target health input/i }),
      );
      fireEvent.change(screen.getByLabelText(/Custom target health factor/i), {
        target: { value: "2.5" },
      });

      expect(screen.getByText("2,500 XLM")).toBeInTheDocument();
      expect(screen.getAllByText("1,250 XLM").length).toBeGreaterThan(0);

      fireEvent.click(
        screen.getByRole("button", { name: /Apply Suggested Collateral/i }),
      );

      expect(screen.getByLabelText(/Collateral Amount/i)).toHaveValue("2,500");
    });

    it("recomputes the target collateral when the borrow amount changes", () => {
      render(
        <BorrowingForm
          initialData={{ ...mockInitialData, amount: 100 }}
          onSubmit={mockOnSubmit}
        />,
      );

      expect(screen.getByText("2,000 XLM")).toBeInTheDocument();

      fireEvent.change(screen.getByLabelText(/Amount to Borrow/i), {
        target: { value: "200" },
      });

      expect(screen.getByText("4,000 XLM")).toBeInTheDocument();
      expect(screen.getByText("1,500 XLM")).toBeInTheDocument();
    });

    it("shows zero top-up when collateral already reaches the target", () => {
      render(
        <BorrowingForm
          initialData={{
            ...mockInitialData,
            amount: 100,
            collateral: "USDC",
            collateralAmount: 300,
          }}
          onSubmit={mockOnSubmit}
        />,
      );

      expect(screen.getByText("240 USDC")).toBeInTheDocument();
      expect(screen.getByText("0 USDC")).toBeInTheDocument();
      expect(
        screen.getByText(/already reaches the selected target/i),
      ).toBeInTheDocument();

      fireEvent.click(
        screen.getByRole("button", { name: /Apply Suggested Collateral/i }),
      );

      expect(screen.getByLabelText(/Collateral Amount/i)).toHaveValue("300");
    });

    it("clamps an unreachable target to the available collateral balance", () => {
      render(
        <BorrowingForm
          initialData={{
            ...mockInitialData,
            amount: 1000,
            collateral: "USDC",
            collateralAmount: 1500,
          }}
          onSubmit={mockOnSubmit}
        />,
      );

      expect(screen.getByText("2,400 USDC")).toBeInTheDocument();
      expect(
        screen.getByText(/Target requires more than your balance/i),
      ).toBeInTheDocument();

      fireEvent.click(
        screen.getByRole("button", { name: /Apply Available Balance/i }),
      );

      expect(screen.getByLabelText(/Collateral Amount/i)).toHaveValue("1,250");
    });

    it("shows an unavailable suggestion for a zero-debt position", () => {
      render(
        <BorrowingForm initialData={mockInitialData} onSubmit={mockOnSubmit} />,
      );

      expect(screen.getByText(/Enter borrow details/i)).toBeInTheDocument();
      expect(screen.getByText(/Unavailable/i)).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /Apply Suggested Collateral/i }),
      ).toBeDisabled();
    });
  });

  // ---------------------------------------------------------------------------
  // Custom loan duration
  // ---------------------------------------------------------------------------

  describe("Custom loan duration", () => {
    /** Helper: render with a non-zero amount so only the duration field can block submit. */
    const renderWithAmount = (amount = 10) => {
      render(
        <BorrowingForm
          initialData={{ ...mockInitialData, amount }}
          onSubmit={mockOnSubmit}
        />,
      );
    };

    it("always renders the Custom chip", () => {
      renderWithAmount();
      expect(
        screen.getByRole("button", { name: /custom/i }),
      ).toBeInTheDocument();
    });

    it("reveals the custom duration input when the Custom chip is clicked", () => {
      renderWithAmount();
      expect(
        screen.queryByLabelText(/Custom loan duration in days/i),
      ).not.toBeInTheDocument();

      fireEvent.click(screen.getByRole("button", { name: /custom/i }));

      expect(
        screen.getByLabelText(/Custom loan duration in days/i),
      ).toBeInTheDocument();
    });

    it("hides the custom input when the user switches back to a preset chip", () => {
      renderWithAmount();

      // Open custom mode
      fireEvent.click(screen.getByRole("button", { name: /custom/i }));
      expect(
        screen.getByLabelText(/Custom loan duration in days/i),
      ).toBeInTheDocument();

      // Switch to the "1 Month" preset
      fireEvent.click(screen.getByRole("button", { name: /1 month/i }));

      expect(
        screen.queryByLabelText(/Custom loan duration in days/i),
      ).not.toBeInTheDocument();
    });

    it("accepts a valid custom term and updates formData.duration", async () => {
      renderWithAmount();
      fireEvent.click(screen.getByRole("button", { name: /custom/i }));

      const input = screen.getByLabelText(/Custom loan duration in days/i);
      fireEvent.change(input, { target: { value: "45" } });

      // No error should appear
      expect(screen.queryByText(/Minimum duration/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/Maximum duration/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/whole number/i)).not.toBeInTheDocument();

      // Form should submit successfully with duration = 45
      fireEvent.click(
        screen.getByRole("button", { name: /Review Loan Request/i }),
      );
      await act(async () => {
        vi.advanceTimersByTime(1000);
        await Promise.resolve();
      });

      expect(mockOnSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ duration: 45 }),
      );
    });

    it("shows a min-bound error for 0 days", () => {
      renderWithAmount();
      fireEvent.click(screen.getByRole("button", { name: /custom/i }));

      const input = screen.getByLabelText(/Custom loan duration in days/i);
      fireEvent.change(input, { target: { value: "0" } });

      expect(
        screen.getByText(/Minimum duration is 1 day/i),
      ).toBeInTheDocument();
    });

    it("shows a min-bound error for a negative number", () => {
      renderWithAmount();
      fireEvent.click(screen.getByRole("button", { name: /custom/i }));

      const input = screen.getByLabelText(/Custom loan duration in days/i);
      fireEvent.change(input, { target: { value: "-5" } });

      expect(
        screen.getByText(/Minimum duration is 1 day/i),
      ).toBeInTheDocument();
    });

    it("shows a max-bound error for 366 days", () => {
      renderWithAmount();
      fireEvent.click(screen.getByRole("button", { name: /custom/i }));

      const input = screen.getByLabelText(/Custom loan duration in days/i);
      fireEvent.change(input, { target: { value: "366" } });

      expect(
        screen.getByText(/Maximum duration is 365 days/i),
      ).toBeInTheDocument();
    });

    it("shows a whole-number error for a decimal value (e.g. 1.5)", () => {
      renderWithAmount();
      fireEvent.click(screen.getByRole("button", { name: /custom/i }));

      const input = screen.getByLabelText(/Custom loan duration in days/i);
      fireEvent.change(input, { target: { value: "1.5" } });

      expect(screen.getByText(/whole number/i)).toBeInTheDocument();
    });

    it("shows an empty-input error when the field is cleared", () => {
      renderWithAmount();
      fireEvent.click(screen.getByRole("button", { name: /custom/i }));

      const input = screen.getByLabelText(/Custom loan duration in days/i);
      // Type something valid first, then erase it
      fireEvent.change(input, { target: { value: "45" } });
      fireEvent.change(input, { target: { value: "" } });

      expect(
        screen.getByText(/Please enter a number of days/i),
      ).toBeInTheDocument();
    });

    it("blocks form submission when an invalid custom value is present", async () => {
      renderWithAmount();
      fireEvent.click(screen.getByRole("button", { name: /custom/i }));

      // Type an out-of-range value
      fireEvent.change(screen.getByLabelText(/Custom loan duration in days/i), {
        target: { value: "0" },
      });

      fireEvent.click(
        screen.getByRole("button", { name: /Review Loan Request/i }),
      );

      expect(
        screen.getByText(/Minimum duration is 1 day/i),
      ).toBeInTheDocument();
      expect(mockOnSubmit).not.toHaveBeenCalled();
    });

    it("blocks form submission when Custom chip is active but the input is empty", async () => {
      renderWithAmount();
      fireEvent.click(screen.getByRole("button", { name: /custom/i }));
      // Do NOT type anything — input stays empty

      fireEvent.click(
        screen.getByRole("button", { name: /Review Loan Request/i }),
      );

      expect(
        screen.getByText(
          /Please fix the errors in the form before continuing/i,
        ),
      ).toBeInTheDocument();
      expect(mockOnSubmit).not.toHaveBeenCalled();
    });

    it("preset chips are unaffected: selecting '1 Month' sets duration to 30", async () => {
      renderWithAmount();

      // Ensure preset mode is active
      fireEvent.click(screen.getByRole("button", { name: /1 month/i }));

      fireEvent.click(
        screen.getByRole("button", { name: /Review Loan Request/i }),
      );
      await act(async () => {
        vi.advanceTimersByTime(1000);
        await Promise.resolve();
      });

      expect(mockOnSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ duration: 30 }),
      );
    });

    it("health preview remains visible after switching to a valid custom term", () => {
      // Render with a non-zero loan amount and collateral to activate the health preview
      render(
        <BorrowingForm
          initialData={{
            ...mockInitialData,
            amount: 100,
            collateral: "USDC",
            collateralAmount: 300,
          }}
          onSubmit={mockOnSubmit}
        />,
      );

      // Health preview should be active from the preset duration
      expect(screen.getByText(/Projected Health Preview/i)).toBeInTheDocument();

      // Switch to custom and enter a valid term
      fireEvent.click(screen.getByRole("button", { name: /custom/i }));
      fireEvent.change(screen.getByLabelText(/Custom loan duration in days/i), {
        target: { value: "120" },
      });

      // Health preview should remain (no crash, no reset to blank)
      expect(screen.getByText(/Projected Health Preview/i)).toBeInTheDocument();
    });

    it("Custom chip has aria-pressed=true when active and aria-pressed=false when not", () => {
      renderWithAmount();
      const chip = screen.getByRole("button", { name: /custom/i });

      expect(chip).toHaveAttribute("aria-pressed", "false");
      fireEvent.click(chip);
      expect(chip).toHaveAttribute("aria-pressed", "true");
    });
  });
});
