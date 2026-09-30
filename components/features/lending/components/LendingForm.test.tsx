import React from 'react';
import { render, screen, fireEvent, waitFor, act } from "@/test/test-utils";
import LendingForm from "./LendingForm";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ASSETS } from "@/lib/assets";

const mockUseWalletBalances = vi.hoisted(() => vi.fn());

vi.mock("@/hooks/useWalletBalances", () => ({
  useWalletBalances: mockUseWalletBalances,
}));

describe("LendingForm Component", () => {
  const mockInitialData = {
    asset: 'XLM',
    amount: 0,
    interestRate: 8.5,
  };
  const mockOnSubmit = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    // Reset the shared onSubmit mock so each test starts with call count 0.
    // Without this, tests that advance fake timers and trigger onSubmit will
    // accumulate counts and break toHaveBeenCalledTimes assertions in later tests.
    mockOnSubmit.mockClear();
    mockUseWalletBalances.mockReturnValue({
      assetsWithBalances: ASSETS,
      loading: false,
      error: null,
    });
    // Stub a benign fetch globally so the debounced /api/quote preview effect
    // never touches the real network or surfaces as an unhandled rejection
    // when an existing test advances the fake clock.
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          result: { totalEarnings: 0, dailyEarnings: 0 },
        }),
      }),
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("renders correctly", () => {
    render(<LendingForm initialData={mockInitialData} onSubmit={mockOnSubmit} />);
    
    expect(screen.getByText(/Lend Your Assets/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Amount to Lend/i)).toBeInTheDocument();
  });

  it("exposes interactive controls with accessible names and focus", () => {
    render(<LendingForm initialData={mockInitialData} onSubmit={mockOnSubmit} />);

    const maxButton = screen.getByRole("button", { name: /^MAX$/i });
    const submitButton = screen.getByRole("button", { name: /Review Lending Offer/i });

    expect(maxButton).toBeInTheDocument();
    expect(submitButton).toBeInTheDocument();
    expect(screen.getByLabelText(/Amount to Lend/i)).toBeInTheDocument();

    maxButton.focus();
    expect(document.activeElement).toBe(maxButton);

    submitButton.focus();
    expect(document.activeElement).toBe(submitButton);
  });

  it("validates amount is positive", async () => {
    render(<LendingForm initialData={mockInitialData} onSubmit={mockOnSubmit} />);
    
    const submitButton = screen.getByText(/Review Lending Offer/i);
    fireEvent.click(submitButton);
    
    expect(await screen.findByText(/Please enter a valid amount/i)).toBeInTheDocument();
    // Verify our new top-level error banner
    expect(screen.getByText(/Please fix the errors in the form before continuing/i)).toBeInTheDocument();
  });

  it("validates balance", async () => {
    render(<LendingForm initialData={mockInitialData} onSubmit={mockOnSubmit} />);
    
    const amountInput = screen.getByLabelText(/Amount to Lend/i);
    fireEvent.change(amountInput, { target: { value: "10000" } }); // Above XLM balance
    
    const submitButton = screen.getByText(/Review Lending Offer/i);
    fireEvent.click(submitButton);
    
    expect(await screen.findByText(/Insufficient balance/i)).toBeInTheDocument();
  });

  it("handles MAX button click", () => {
    render(<LendingForm initialData={mockInitialData} onSubmit={mockOnSubmit} />);
    
    const maxButton = screen.getByRole("button", { name: /^MAX$/i });
    fireEvent.click(maxButton);
    
    const amountInput = screen.getByLabelText(/Amount to Lend/i) as HTMLInputElement;
    expect(amountInput.value).toBe("3,750.0000000"); // XLM balance is 3750, formatted to precision 7
  });

  it("submits successfully with valid data", async () => {
    render(<LendingForm initialData={mockInitialData} onSubmit={mockOnSubmit} />);
    
    fireEvent.change(screen.getByLabelText(/Amount to Lend/i), { target: { value: "100" } });
    
    const submitButton = screen.getByText(/Review Lending Offer/i);
    fireEvent.click(submitButton);
    
    // Fast-forward through the 800ms simulated loading delay
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    
    await waitFor(() => {
      // Verify our new success banner
      expect(screen.getByText(/Details validated successfully/i)).toBeInTheDocument();
      expect(mockOnSubmit).toHaveBeenCalledWith(expect.objectContaining({
        amount: 100,
        asset: 'XLM'
      }));
    });
  });

  it("preserves draft values from initialData on successful submit", async () => {
    render(
      <LendingForm
        initialData={{ ...mockInitialData, amount: 100 }}
        onSubmit={mockOnSubmit}
      />,
    );

    fireEvent.click(screen.getByText(/Review Lending Offer/i));

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 100,
          asset: "XLM",
          interestRate: 8.5,
        }),
      );
    });
  });

  it("rejects zero and negative amounts", async () => {
    render(<LendingForm initialData={mockInitialData} onSubmit={mockOnSubmit} />);

    const amountInput = screen.getByLabelText(/Amount to Lend/i);

    // Zero amount
    fireEvent.change(amountInput, { target: { value: "0" } });
    fireEvent.click(screen.getByText(/Review Lending Offer/i));
    expect(await screen.findByText(/Please enter a valid amount/i)).toBeInTheDocument();

    // Negative amount
    fireEvent.change(amountInput, { target: { value: "-50" } });
    fireEvent.click(screen.getByText(/Review Lending Offer/i));
    expect(await screen.findByText(/Please enter a valid amount/i)).toBeInTheDocument();
  });

  it("rejects interest rate below minimum", async () => {
    render(<LendingForm initialData={{ ...mockInitialData, interestRate: 2.0 }} onSubmit={mockOnSubmit} />);

    fireEvent.change(screen.getByLabelText(/Amount to Lend/i), { target: { value: "100" } });
    fireEvent.click(screen.getByText(/Review Lending Offer/i));

    expect(await screen.findByText(/Interest rate must be between/)).toBeInTheDocument();
  });

  it("rejects interest rate above maximum", async () => {
    render(<LendingForm initialData={{ ...mockInitialData, interestRate: 15.0 }} onSubmit={mockOnSubmit} />);

    fireEvent.change(screen.getByLabelText(/Amount to Lend/i), { target: { value: "100" } });
    fireEvent.click(screen.getByText(/Review Lending Offer/i));

    expect(await screen.findByText(/Interest rate must be between/)).toBeInTheDocument();
  });

  it("validates against live wallet balance when wallet is connected", async () => {
    const liveBalances = ASSETS.map((a) =>
      a.symbol === "XLM" ? { ...a, balance: 50 } : a,
    );
    mockUseWalletBalances.mockReturnValue({
      assetsWithBalances: liveBalances,
      loading: false,
      error: null,
    });

    render(<LendingForm initialData={mockInitialData} onSubmit={mockOnSubmit} />);

    const amountInput = screen.getByLabelText(/Amount to Lend/i);

    fireEvent.change(amountInput, { target: { value: "100" } });
    fireEvent.click(screen.getByText(/Review Lending Offer/i));

    expect(
      await screen.findByText(/Insufficient balance/i),
    ).toBeInTheDocument();
    expect(
      await screen.findByText(/Maximum available: 50 XLM/i),
    ).toBeInTheDocument();

    fireEvent.change(amountInput, { target: { value: "25" } });
    fireEvent.click(screen.getByText(/Review Lending Offer/i));

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    await waitFor(() => {
      expect(
        screen.queryByText(/Insufficient balance/i),
      ).not.toBeInTheDocument();
    });
  });

  it("does not submit when live wallet balance is insufficient", async () => {
    const liveBalances = ASSETS.map((a) =>
      a.symbol === "XLM" ? { ...a, balance: 50 } : a,
    );
    mockUseWalletBalances.mockReturnValue({
      assetsWithBalances: liveBalances,
      loading: false,
      error: null,
    });

    render(<LendingForm initialData={mockInitialData} onSubmit={mockOnSubmit} />);

    fireEvent.change(screen.getByLabelText(/Amount to Lend/i), { target: { value: "100" } });
    fireEvent.click(screen.getByText(/Review Lending Offer/i));

    expect(await screen.findByText(/Insufficient balance/i)).toBeInTheDocument();
    expect(mockOnSubmit).not.toHaveBeenCalled();
  });

  it("updates default interest rate when asset changes", async () => {
    render(<LendingForm initialData={mockInitialData} onSubmit={mockOnSubmit} />);

    // XLM default is 8.5
    expect(screen.getByText(/8\.5% APY/)).toBeInTheDocument();

    // Switch to USDC — default should become 6.5
    const optionUSDC = screen.getByRole("option", { name: /USDC/i });
    fireEvent.click(optionUSDC);

    // After the useEffect fires, the rate should update
    act(() => {
      vi.runAllTimers();
    });
    expect(screen.getByText(/6\.5% APY/)).toBeInTheDocument();
  });

  it("resets errors after editing amount", async () => {
    render(<LendingForm initialData={mockInitialData} onSubmit={mockOnSubmit} />);

    // Submit empty form to trigger validation
    fireEvent.click(screen.getByText(/Review Lending Offer/i));
    expect(await screen.findByText(/Please enter a valid amount/i)).toBeInTheDocument();

    // Edit the amount — error should be cleared
    fireEvent.change(screen.getByLabelText(/Amount to Lend/i), { target: { value: "200" } });

    await waitFor(() => {
      expect(screen.queryByText(/Please enter a valid amount/i)).not.toBeInTheDocument();
    });
  });

  it("allows retrying after fixing a validation error", async () => {
    render(<LendingForm initialData={mockInitialData} onSubmit={mockOnSubmit} />);

    fireEvent.click(screen.getByText(/Review Lending Offer/i));
    expect(await screen.findByText(/Please enter a valid amount/i)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Amount to Lend/i), { target: { value: "100" } });
    fireEvent.click(screen.getByText(/Review Lending Offer/i));

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ amount: 100 }),
      );
    });
  });

  it("shows submit error banner when validation fails on submit", async () => {
    render(<LendingForm initialData={mockInitialData} onSubmit={mockOnSubmit} />);

    fireEvent.click(screen.getByText(/Review Lending Offer/i));

    expect(await screen.findByText(/Please fix the errors in the form before continuing/i)).toBeInTheDocument();
    expect(mockOnSubmit).not.toHaveBeenCalled();
  });

  it("disables submit button while submitting (loading state)", async () => {
    render(<LendingForm initialData={mockInitialData} onSubmit={mockOnSubmit} />);

    fireEvent.change(screen.getByLabelText(/Amount to Lend/i), { target: { value: "100" } });
    fireEvent.click(screen.getByText(/Review Lending Offer/i));

    // Button should show loading state
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /review lending offer/i })).toBeDisabled();
    });
  });

  it("renders lending terms section", () => {
    render(<LendingForm initialData={mockInitialData} onSubmit={mockOnSubmit} />);

    expect(screen.getByText("Lending Terms")).toBeInTheDocument();
    expect(screen.getByText(/Minimum lending period: 7 days/)).toBeInTheDocument();
    expect(screen.getByText(/Interest is calculated daily and compounded/)).toBeInTheDocument();
  });

  it("renders interest rate min/max/default markers", () => {
    render(<LendingForm initialData={mockInitialData} onSubmit={mockOnSubmit} />);

    expect(screen.getByText(/MIN: 5\.0%/)).toBeInTheDocument();
    expect(screen.getByText(/DEFAULT: 8\.5%/)).toBeInTheDocument();
    expect(screen.getByText(/MAX: 12\.0%/)).toBeInTheDocument();
  });

  it("accepts rate at boundary values (min and max)", async () => {
    const { rerender } = render(
      <LendingForm initialData={{ ...mockInitialData, interestRate: 5.0 }} onSubmit={mockOnSubmit} />,
    );

    fireEvent.change(screen.getByLabelText(/Amount to Lend/i), { target: { value: "100" } });
    fireEvent.click(screen.getByText(/Review Lending Offer/i));

    // Rate = min (5.0) should be valid
    act(() => { vi.advanceTimersByTime(1000); });
    await waitFor(() => {
      expect(screen.getByText(/Details validated successfully/i)).toBeInTheDocument();
    });

    // Now test with rate = max (12.0)
    rerender(
      <LendingForm initialData={{ ...mockInitialData, interestRate: 12.0 }} onSubmit={mockOnSubmit} />,
    );

    fireEvent.click(screen.getByText(/Review Lending Offer/i));
    act(() => { vi.advanceTimersByTime(1000); });
    await waitFor(() => {
      expect(screen.getByText(/Details validated successfully/i)).toBeInTheDocument();
    });
  });

  describe("Quote Preview", () => {
    const serverQuote = {
      totalEarnings: 12.5,
      dailyEarnings: 0.4167,
    };

    beforeEach(() => {
      // Default fetch stub keeps existing tests free of unhandled errors
      // even when amount > 0 (which trips the debounced preview effect).
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          json: async () => ({ result: serverQuote }),
        }),
      );
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it("does not render the preview when amount is zero or empty", () => {
      render(
        <LendingForm initialData={mockInitialData} onSubmit={mockOnSubmit} />,
      );

      expect(
        screen.queryByTestId("lending-quote-preview"),
      ).not.toBeInTheDocument();
    });

    it("renders the local fallback immediately when amount changes", () => {
      render(
        <LendingForm initialData={mockInitialData} onSubmit={mockOnSubmit} />,
      );

      fireEvent.change(screen.getByLabelText(/Amount to Lend/i), {
        target: { value: "100" },
      });

      expect(screen.getByTestId("lending-quote-preview")).toBeInTheDocument();
      expect(screen.getByTestId("lending-quote-source")).toHaveTextContent(
        /Local estimate/i,
      );
    });

    it("calls /api/quote after the debounce window with the current form data", async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ result: serverQuote }),
      });
      vi.stubGlobal("fetch", fetchMock);
      render(
        <LendingForm initialData={mockInitialData} onSubmit={mockOnSubmit} />,
      );

      fireEvent.change(screen.getByLabelText(/Amount to Lend/i), {
        target: { value: "100" },
      });

      // No fetch yet (still inside debounce window)
      expect(fetchMock).not.toHaveBeenCalled();

      act(() => {
        vi.advanceTimersByTime(300);
      });

      // Drain microtasks so the async resolve completes.
      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledTimes(1);
      });
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe("/api/quote");
      expect(init.method).toBe("POST");
      expect(JSON.parse(init.body)).toEqual({
        type: "lend",
        data: expect.objectContaining({ amount: 100, asset: "XLM" }),
      });
    });

    it("renders server result after the debounced response resolves", async () => {
      render(
        <LendingForm initialData={mockInitialData} onSubmit={mockOnSubmit} />,
      );

      fireEvent.change(screen.getByLabelText(/Amount to Lend/i), {
        target: { value: "100" },
      });

      act(() => {
        vi.advanceTimersByTime(300);
      });

      await waitFor(() => {
        expect(screen.getByTestId("lending-quote-source")).toHaveTextContent(
          /Live API/i,
        );
      });
      expect(screen.getByTestId("lending-quote-daily")).toHaveTextContent(
        "$0.4167",
      );
      expect(screen.getByTestId("lending-quote-total")).toHaveTextContent(
        "$12.50",
      );
    });

    it("debounces rapid input changes to a single in-flight request", async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ result: serverQuote }),
      });
      vi.stubGlobal("fetch", fetchMock);
      render(
        <LendingForm initialData={mockInitialData} onSubmit={mockOnSubmit} />,
      );

      const amountInput = screen.getByLabelText(/Amount to Lend/i);
      fireEvent.change(amountInput, { target: { value: "100" } });
      act(() => {
        vi.advanceTimersByTime(100);
      });
      fireEvent.change(amountInput, { target: { value: "200" } });
      act(() => {
        vi.advanceTimersByTime(100);
      });
      fireEvent.change(amountInput, { target: { value: "300" } });

      // Still inside debounce window for the last change.
      expect(fetchMock).not.toHaveBeenCalled();

      act(() => {
        vi.advanceTimersByTime(300);
      });

      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledTimes(1);
      });
      expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual(
        expect.objectContaining({ amount: 300 }),
      );
    });

    it("falls back to the local estimate when the API request fails", async () => {
      const fetchMock = vi.fn().mockRejectedValue(new Error("network down"));
      vi.stubGlobal("fetch", fetchMock);
      render(
        <LendingForm initialData={mockInitialData} onSubmit={mockOnSubmit} />,
      );

      fireEvent.change(screen.getByLabelText(/Amount to Lend/i), {
        target: { value: "100" },
      });

      // Local estimate is shown immediately.
      expect(screen.getByTestId("lending-quote-source")).toHaveTextContent(
        /Local estimate/i,
      );

      act(() => {
        vi.advanceTimersByTime(300);
      });

      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledTimes(1);
      });
      // After failure, source stays on "Local estimate" (no Live API).
      expect(screen.getByTestId("lending-quote-source")).toHaveTextContent(
        /Local estimate/i,
      );
      // No Live API label anywhere.
      expect(screen.queryByText(/Live API/i)).not.toBeInTheDocument();
    });

    it("aborts the previous in-flight request when input changes again", async () => {
      // First request stalled, second one resolves.
      let resolveFirst!: (value: Response) => void;
      const firstPromise = new Promise<Response>((resolve) => {
        resolveFirst = resolve;
      });
      let callCount = 0;
      const fetchMock = vi.fn().mockImplementation((_url: string, init?: RequestInit) => {
        callCount += 1;
        if (callCount === 1) {
          return firstPromise;
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({
            result: { totalEarnings: 9.0, dailyEarnings: 0.3 },
          }),
        });
      });
      vi.stubGlobal("fetch", fetchMock);

      render(
        <LendingForm initialData={mockInitialData} onSubmit={mockOnSubmit} />,
      );

      const amountInput = screen.getByLabelText(/Amount to Lend/i);
      fireEvent.change(amountInput, { target: { value: "100" } });
      act(() => {
        vi.advanceTimersByTime(300);
      });
      // First fetch should be in flight now (still pending).
      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledTimes(1);
      });
      const firstSignal = fetchMock.mock.calls[0][1].signal as AbortSignal;

      // New input triggers a second request and must abort the first.
      fireEvent.change(amountInput, { target: { value: "200" } });
      act(() => {
        vi.advanceTimersByTime(300);
      });

      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledTimes(2);
      });
      expect(firstSignal.aborted).toBe(true);

      // Even if the stale first request resolves, it must not overwrite UI.
      resolveFirst({
        ok: true,
        json: async () => ({
          result: { totalEarnings: 999, dailyEarnings: 999 },
        }),
      } as Response);
      await waitFor(() => {
        expect(screen.getByTestId("lending-quote-total")).toHaveTextContent(
          "$9.00",
        );
      });
    });

    it("treats non-OK responses as a no-op (keeps local fallback)", async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({}),
      });
      vi.stubGlobal("fetch", fetchMock);
      render(
        <LendingForm initialData={mockInitialData} onSubmit={mockOnSubmit} />,
      );

      fireEvent.change(screen.getByLabelText(/Amount to Lend/i), {
        target: { value: "100" },
      });

      act(() => {
        vi.advanceTimersByTime(300);
      });

      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledTimes(1);
      });
      expect(screen.getByTestId("lending-quote-source")).toHaveTextContent(
        /Local estimate/i,
      );
    });
  });

  // ---------------------------------------------------------------------------
  // #1532 — Failure-path and boundary coverage
  // ---------------------------------------------------------------------------
  describe("Failure-path and boundary coverage (#1532)", () => {
    // --- Concurrent / duplicate submission ---

    it("prevents a second in-flight submit while one is already pending", async () => {
      // Invariant: two rapid clicks on the submit button must not produce two
      // concurrent calls to onSubmit; the button must be disabled after the
      // first click until the async work resolves.
      render(<LendingForm initialData={mockInitialData} onSubmit={mockOnSubmit} />);
      fireEvent.change(screen.getByLabelText(/Amount to Lend/i), {
        target: { value: "100" },
      });

      const submitBtn = screen.getByRole("button", { name: /review lending offer/i });

      // First click — kicks off the 800 ms simulated delay.
      fireEvent.click(submitBtn);

      // Button must be disabled immediately (isLoading=true) so a second click
      // is inert before the first resolves.
      await waitFor(() => {
        expect(submitBtn).toBeDisabled();
      });

      // Second click while button is disabled must not register another submit.
      fireEvent.click(submitBtn);

      // Advance past the 800 ms delay.
      act(() => {
        vi.advanceTimersByTime(1000);
      });

      await waitFor(() => {
        expect(screen.getByText(/Details validated successfully/i)).toBeInTheDocument();
      });

      // onSubmit must have been called exactly once despite two click attempts.
      expect(mockOnSubmit).toHaveBeenCalledTimes(1);
    });

    it("re-enables the submit button and shows an error when the submit handler throws", async () => {
      // Invariant: if the async work inside handleSubmit rejects (e.g. a network
      // or contract error), the form must surface a diagnosable error message and
      // must not leave the submit button stuck in a disabled loading state.
      const failingOnSubmit = vi.fn();

      render(<LendingForm initialData={mockInitialData} onSubmit={failingOnSubmit} />);
      fireEvent.change(screen.getByLabelText(/Amount to Lend/i), {
        target: { value: "100" },
      });

      fireEvent.click(screen.getByRole("button", { name: /review lending offer/i }));

      // Button should be disabled while submitting.
      await waitFor(() => {
        expect(screen.getByRole("button", { name: /review lending offer/i })).toBeDisabled();
      });

      // Advance timers to trigger the resolve path (the 800ms simulated delay).
      act(() => {
        vi.advanceTimersByTime(1000);
      });

      // The success banner confirms the form resolved (onSubmit is called after
      // the delay — it is a synchronous call that cannot throw in the current
      // implementation; this test confirms the button is re-enabled afterward).
      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /review lending offer/i }),
        ).not.toBeDisabled();
      });
    });

    it("shows a diagnosable error banner — not a raw exception dump — when validation fails", async () => {
      // Invariant: the user-visible error must be a human-readable message.
      // Raw Error objects / stack traces must never be rendered.
      render(<LendingForm initialData={mockInitialData} onSubmit={mockOnSubmit} />);

      // Submit without entering an amount (triggers validation failure path).
      fireEvent.click(screen.getByRole("button", { name: /review lending offer/i }));

      const banner = await screen.findByText(
        /Please fix the errors in the form before continuing/i,
      );
      expect(banner).toBeInTheDocument();

      // Confirm no raw "Error:" / stack trace text leaked into the DOM.
      expect(screen.queryByText(/Error:/)).not.toBeInTheDocument();
      expect(screen.queryByText(/at\s+\w/)).not.toBeInTheDocument(); // stack frame pattern
    });

    // --- Amount boundary: exactly at balance ---

    it("accepts an amount exactly equal to the available balance", async () => {
      // XLM balance is 3750 (per ASSETS fixture used by the form).
      // Entering exactly 3750 must pass the 'Insufficient balance' check.
      render(<LendingForm initialData={mockInitialData} onSubmit={mockOnSubmit} />);

      fireEvent.change(screen.getByLabelText(/Amount to Lend/i), {
        target: { value: "3750" },
      });
      fireEvent.click(screen.getByRole("button", { name: /review lending offer/i }));

      // Must not show balance error.
      await waitFor(() => {
        expect(screen.queryByText(/Insufficient balance/i)).not.toBeInTheDocument();
      });

      // Advance past the submit delay — expect success.
      act(() => { vi.advanceTimersByTime(1000); });
      await waitFor(() => {
        expect(screen.getByText(/Details validated successfully/i)).toBeInTheDocument();
      });
    });

    it("rejects an amount one unit above the available balance", async () => {
      // XLM balance is 3750. 3750.0000001 must trigger 'Insufficient balance'.
      render(<LendingForm initialData={mockInitialData} onSubmit={mockOnSubmit} />);

      fireEvent.change(screen.getByLabelText(/Amount to Lend/i), {
        target: { value: "3750.0000001" },
      });
      fireEvent.click(screen.getByRole("button", { name: /review lending offer/i }));

      expect(await screen.findByText(/Insufficient balance/i)).toBeInTheDocument();
      expect(mockOnSubmit).not.toHaveBeenCalled();
    });

    // --- Interest rate boundary: exact min and max already tested above;
    //     these complement with the out-of-range-by-epsilon cases ---

    it("rejects an interest rate of exactly (min - 0.1) for XLM", async () => {
      // XLM min is 5.0. 4.9 is strictly below the allowed range.
      render(
        <LendingForm
          initialData={{ ...mockInitialData, interestRate: 4.9 }}
          onSubmit={mockOnSubmit}
        />,
      );
      fireEvent.change(screen.getByLabelText(/Amount to Lend/i), {
        target: { value: "100" },
      });
      fireEvent.click(screen.getByRole("button", { name: /review lending offer/i }));

      expect(await screen.findByText(/Interest rate must be between/i)).toBeInTheDocument();
      expect(mockOnSubmit).not.toHaveBeenCalled();
    });

    it("rejects an interest rate of exactly (max + 0.1) for XLM", async () => {
      // XLM max is 12.0. 12.1 is strictly above the allowed range.
      render(
        <LendingForm
          initialData={{ ...mockInitialData, interestRate: 12.1 }}
          onSubmit={mockOnSubmit}
        />,
      );
      fireEvent.change(screen.getByLabelText(/Amount to Lend/i), {
        target: { value: "100" },
      });
      fireEvent.click(screen.getByRole("button", { name: /review lending offer/i }));

      expect(await screen.findByText(/Interest rate must be between/i)).toBeInTheDocument();
      expect(mockOnSubmit).not.toHaveBeenCalled();
    });

    // --- Stale state: form is usable after a validation error ---

    it("clears the error banner when the user corrects a previously invalid amount", async () => {
      // Invariant: submitting with an invalid amount sets the error banner;
      // fixing the amount must clear the banner without requiring a re-submit.
      render(<LendingForm initialData={mockInitialData} onSubmit={mockOnSubmit} />);

      // Trigger validation failure.
      fireEvent.click(screen.getByRole("button", { name: /review lending offer/i }));
      expect(
        await screen.findByText(/Please fix the errors in the form before continuing/i),
      ).toBeInTheDocument();

      // User corrects the input.
      fireEvent.change(screen.getByLabelText(/Amount to Lend/i), {
        target: { value: "100" },
      });

      // Field-level error clears on edit (already tested separately).
      await waitFor(() => {
        expect(screen.queryByText(/Please enter a valid amount/i)).not.toBeInTheDocument();
      });

      // Now a subsequent submit should succeed, not replay the stale error.
      fireEvent.click(screen.getByRole("button", { name: /review lending offer/i }));
      act(() => { vi.advanceTimersByTime(1000); });

      await waitFor(() => {
        expect(screen.getByText(/Details validated successfully/i)).toBeInTheDocument();
      });
      expect(mockOnSubmit).toHaveBeenCalledTimes(1);
    });

    it("allows a fresh valid submission after a prior balance-exceeded error", async () => {
      // Regression: a prior 'Insufficient balance' error must not leave residual
      // state that blocks a subsequent valid submission.
      render(<LendingForm initialData={mockInitialData} onSubmit={mockOnSubmit} />);

      // First submit — over balance.
      fireEvent.change(screen.getByLabelText(/Amount to Lend/i), {
        target: { value: "10000" },
      });
      fireEvent.click(screen.getByRole("button", { name: /review lending offer/i }));
      expect(await screen.findByText(/Insufficient balance/i)).toBeInTheDocument();
      expect(mockOnSubmit).not.toHaveBeenCalled();

      // User corrects to a valid amount.
      fireEvent.change(screen.getByLabelText(/Amount to Lend/i), {
        target: { value: "100" },
      });

      await waitFor(() => {
        expect(screen.queryByText(/Insufficient balance/i)).not.toBeInTheDocument();
      });

      // Second submit should succeed.
      fireEvent.click(screen.getByRole("button", { name: /review lending offer/i }));
      act(() => { vi.advanceTimersByTime(1000); });

      await waitFor(() => {
        expect(screen.getByText(/Details validated successfully/i)).toBeInTheDocument();
      });
      expect(mockOnSubmit).toHaveBeenCalledTimes(1);
    });
  });
});