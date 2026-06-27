import React from 'react';
import { render, screen, fireEvent, waitFor, act } from "@/test/test-utils";
import LendingForm from "./LendingForm";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("LendingForm Component", () => {
  const mockInitialData = {
    asset: 'XLM',
    amount: 0,
    interestRate: 8.5,
  };
  const mockOnSubmit = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
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
});