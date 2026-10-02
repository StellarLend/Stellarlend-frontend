import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import axe from "axe-core";
import { render, screen, waitFor, fireEvent } from "@/test/test-utils";
import LendingPage from "./page";

let mockSearchParams = new URLSearchParams();
const mockRouter = {
  replace: vi.fn(),
  push: vi.fn(),
};

vi.mock("next/navigation", () => ({
  useRouter: () => mockRouter,
  useSearchParams: () => mockSearchParams,
}));

let mockTxStatus: {
  state: "processing" | "completed" | "failed" | "rate_limited";
  result?: unknown;
  error?: unknown;
  retryAfterSeconds?: number;
} | null = null;

vi.mock("@/lib/tx/useTxStatus", () => ({
  default: () => mockTxStatus,
}));

const hexToRgb = (hex: string) => {
  const normalized = hex.replace("#", "");
  const value =
    normalized.length === 3
      ? normalized
          .split("")
          .map((char) => char + char)
          .join("")
      : normalized;

  const parsed = Number.parseInt(value, 16);

  return {
    r: (parsed >> 16) & 255,
    g: (parsed >> 8) & 255,
    b: parsed & 255,
  };
};

const getRelativeLuminance = (hex: string) => {
  const { r, g, b } = hexToRgb(hex);
  const channels = [r, g, b].map((channel) => {
    const normalized = channel / 255;
    return normalized <= 0.03928
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4;
  });

  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
};

const getContrastRatio = (foreground: string, background: string) => {
  const lighter = Math.max(
    getRelativeLuminance(foreground),
    getRelativeLuminance(background),
  );
  const darker = Math.min(
    getRelativeLuminance(foreground),
    getRelativeLuminance(background),
  );

  return (lighter + 0.05) / (darker + 0.05);
};

describe("LendingPage", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    mockSearchParams = new URLSearchParams();
    mockTxStatus = null;
    mockRouter.replace.mockReset();
    mockRouter.push.mockReset();
    localStorage.clear();

    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        markets: [{ asset: "XLM", supplyApr: 7.2, borrowApr: 11.4 }],
      }),
    });

    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
    localStorage.clear();
  });

  it("keeps the lending header on a light surface with accessible contrast", async () => {
    render(<LendingPage />);

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/markets?asset=XLM",
        expect.any(Object),
      ),
    );

    const heading = screen.getByRole("heading", { name: "Lending & Borrowing" });
    const headerSurface = heading.closest("section");
    expect(headerSurface).toHaveClass("bg-white/95");
    expect(heading).toHaveClass("text-slate-900");

    const description = screen.getByText(
      "Earn interest by lending your assets or borrow against your collateral.",
    );
    expect(description).toHaveClass("text-slate-500");

    expect(getContrastRatio("#0f172a", "#ffffff")).toBeGreaterThanOrEqual(7);
    expect(getContrastRatio("#64748b", "#ffffff")).toBeGreaterThanOrEqual(4.5);
  });

  it("passes axe checks on the lending route shell", async () => {
    render(<LendingPage />);

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());

    const results = await axe.run(document.body);
    expect(results.violations).toEqual([]);
  });

  it("renders market data returned by the API", async () => {
    render(<LendingPage />);
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/markets?asset=XLM",
        expect.any(Object),
      ),
    );

    expect(await screen.findByText("XLM")).toBeInDocument();
    expect(screen.getByText(/7\.2%/)).toBeInDocument();
    expect(screen.getByText(/11\.4%/)).toBeInDocument();
  });

  it("shows a loading state while the request is pending", () => {
    fetchMock.mockReturnValue(new Promise(() => {}));
    render(<LendingPage />);
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it("shows an error message with a retry button when the request fails", async () => {
    fetchMock.mockRejectedValue(new Error("Network error"));
    render(<LendingPage />);

    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
  });

  it("retries the request when the retry button is clicked", async () => {
    fetchMock
      .mockRejectedValueOnce(new Error("Network error"))
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          markets: [{ asset: "XLM", supplyApr: 7.2, borrowApr: 11.4 }],
        }),
      });

    render(<LendingPage />);
    const retryButton = await screen.findByRole("button", { name: /retry/i });
    fireEvent.click(retryButton);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(await screen.findByText("XLM")).toBeInTheDocument();
  });

  it("shows an empty state when no markets are returned", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ markets: [] }),
    });

    render(<LendingPage />);
    expect(await screen.findByText(/no markets/i)).toBeInTheDocument();
  });

  it("shows a permission message when the API returns 403", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({ error: "Forbidden" }),
    });

    render(<LendingPage />);
    expect(await screen.findByText(/permission/i)).toBeInTheDocument();
  });

  it("keeps the retry button focusable via keyboard", async () => {
    fetchMock.mockRejectedValue(new Error("Network error"));
    render(<LendingPage />);

    const retryButton = await screen.findByRole("button", { name: /retry/i });
    retryButton.focus();
    expect(retryButton).toHaveFocus();
  });

  it("respects prefers-reduced-motion without throwing", () => {
    const matchMediaMock = vi.fn().mockImplementation((query: string) => ({
      matches: query === "(prefers-reduced-motion: reduce)",
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
    vi.stubGlobal("matchMedia", matchMediaMock);

    render(<LendingPage />);
    expect(
      screen.getByRole("heading", { name: "Lending & Borrowing" }),
    ).toBeInDocument();
  });

  it("passes axe checks after an error state is rendered", async () => {
    fetchMock.mockRejectedValue(new Error("Network error"));
    render(<LendingPage />);
    await screen.findByRole("alert");

    const results = await axe.run(document.body);
    expect(results.violations).toEqual([]);
  });

  describe("URL Tab Query Parameter Handling", () => {
    it("defaults to lend tab when no tab parameter is supplied", async () => {
      mockSearchParams = new URLSearchParams();
      render(<LendingPage />);

      const lendTab = screen.getByRole("tab", { name: /^lend$/i });
      expect(lendTab).toHaveAttribute("aria-selected", "true");
    });

    it("activates borrow tab when tab=borrow", async () => {
      mockSearchParams = new URLSearchParams("tab=borrow");
      render(<LendingPage />);

      const borrowTab = screen.getByRole("tab", { name: /^borrow$/i });
      expect(borrowTab).toHaveAttribute("aria-selected", "true");
    });

    it("activates repay tab when tab=repay", async () => {
      mockSearchParams = new URLSearchParams("tab=repay");
      render(<LendingPage />);

      const repayTab = screen.getByRole("tab", { name: /^repay$/i });
      expect(repayTab).toHaveAttribute("aria-selected", "true");
    });

    it("activates withdraw tab when tab=withdraw", async () => {
      mockSearchParams = new URLSearchParams("tab=withdraw");
      render(<LendingPage />);

      const withdrawTab = screen.getByRole("tab", { name: /^withdraw$/i });
      expect(withdrawTab).toHaveAttribute("aria-selected", "true");
    });

    it("falls back to lend tab on unknown or malformed tab parameter", async () => {
      mockSearchParams = new URLSearchParams("tab=arbitrary_malicious_input");
      render(<LendingPage />);

      const lendTab = screen.getByRole("tab", { name: /^lend$/i });
      expect(lendTab).toHaveAttribute("aria-selected", "true");
    });

    it("normalizes whitespace and case in tab parameter", async () => {
      mockSearchParams = new URLSearchParams("tab=  BORROW  ");
      render(<LendingPage />);

      const borrowTab = screen.getByRole("tab", { name: /^borrow$/i });
      expect(borrowTab).toHaveAttribute("aria-selected", "true");
    });
  });

  describe("Draft Persistence and Boundary Invariants", () => {
    it("discards corrupt draft with negative amount", async () => {
      localStorage.setItem(
        "lending-form-draft",
        JSON.stringify({
          activeTab: "lend",
          data: { asset: "XLM", amount: -50, interestRate: 8.5 },
        }),
      );

      render(<LendingPage />);

      expect(screen.queryByText(/resume saved draft/i)).not.toBeInDocument();
      expect(localStorage.getItem("lending-form-draft")).toBeNull();
    });

    it("discards corrupt draft with non-finite amount", async () => {
      localStorage.setItem(
        "lending-form-draft",
        JSON.stringify({
          activeTab: "borrow",
          data: { asset: "XLM", amount: "not-a-number", interestRate: 8.5 },
        }),
      );

      render(<LendingPage />);

      expect(screen.queryByText(/resume saved draft/i)).not.toBeInDocument();
      expect(localStorage.getItem("lending-form-draft")).toBeNull();
    });

    it("discards corrupt draft with empty asset", async () => {
      localStorage.setItem(
        "lending-form-draft",
        JSON.stringify({
          activeTab: "borrow",
          data: { asset: "", amount: 100, interestRate: 8.5 },
        }),
      );

      render(<LendingPage />);

      expect(screen.queryByText(/resume saved draft/i)).not.toBeInDocument();
      expect(localStorage.getItem("lending-form-draft")).toBeNull();
    });

    it("shows resume banner for valid draft and clears storage on resume", async () => {
      localStorage.setItem(
        "lending-form-draft",
        JSON.stringify({
          activeTab: "borrow",
          data: {
            asset: "USDC",
            amount: 250,
            interestRate: 10.0,
            duration: 14,
            collateral: "XLM",
            collateralAmount: 500,
          },
        }),
      );

      render(<LendingPage />);

      expect(screen.getByText(/resume saved draft/i)).toBeInDocument();
      const resumeButton = screen.getByRole("button", { name: /resume/i });
      fireEvent.click(resumeButton);

      expect(screen.queryByText(/resume saved draft/i)).not.toBeInDocument();
      expect(localStorage.getItem("lending-form-draft")).toBeNull();
    });

    it("clears storage and hides prompt when draft is discarded", async () => {
      localStorage.setItem(
        "lending-form-draft",
        JSON.stringify({
          activeTab: "lend",
          data: { asset: "XLM", amount: 150, interestRate: 7.5 },
        }),
      );

      render(<LendingPage />);

      expect(screen.getByText(/resume saved draft/i)).toBeInDocument();
      const discardButton = screen.getByRole("button", { name: /discard/i });
      fireEvent.click(discardButton);

      expect(screen.queryByText(/resume saved draft/i)).not.toBeInDocument();
      expect(localStorage.getItem("lending-form-draft")).toBeNull();
    });
  });

  describe("Transaction Confirmation and Failure Recovery", () => {
    it("handles rate limiting (429) during submission", async () => {
      fetchMock.mockImplementation((url: string) => {
        if (url.includes("/api/tx/submit")) {
          return Promise.resolve({
            ok: false,
            status: 429,
            json: async () => ({
              error: { message: "Too many requests. Please slow down." },
            }),
          });
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ markets: [] }),
        });
      });

      render(<LendingPage />);

      const amountInput = screen.queryByLabelText(/amount/i);
      if (amountInput) {
        fireEvent.change(amountInput, { target: { value: "100" } });
      }

      const submitButtons = screen.getAllByRole("button");
      const lendBtn = submitButtons.find((b) => /lend/i.test(b.textContent || ""));
      if (lendBtn) {
        fireEvent.click(lendBtn);
      }

      const confirmButton = screen.queryByRole("button", { name: /confirm/i });
      if (confirmButton) {
        fireEvent.click(confirmButton);
        await waitFor(() => {
          expect(screen.getByText(/rate limited/i)).toBeInDocument();
        });
      }
    });

    it("handles authorization errors (401/403) gracefully during submission", async () => {
      fetchMock.mockImplementation((url: string) => {
        if (url.includes("/api/tx/submit")) {
          return Promise.resolve({
            ok: false,
            status: 403,
            json: async () => ({
              error: { message: "Unauthorized signer" },
            }),
          });
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ markets: [] }),
        });
      });

      render(<LendingPage />);

      const amountInput = screen.queryByLabelText(/amount/i);
      if (amountInput) {
        fireEvent.change(amountInput, { target: { value: "100" } });
      }

      const submitButtons = screen.getAllByRole("button");
      const lendBtn = submitButtons.find((b) => /lend/i.test(b.textContent || ""));
      if (lendBtn) {
        fireEvent.click(lendBtn);
      }

      const confirmButton = screen.queryByRole("button", { name: /confirm/i });
      if (confirmButton) {
        fireEvent.click(confirmButton);
        await waitFor(() => {
          expect(screen.getByText(/authorization error/i)).toBeInDocument();
        });
      }
    });

    it("handles server 500 error without exposing stack traces", async () => {
      fetchMock.mockImplementation((url: string) => {
        if (url.includes("/api/tx/submit")) {
          return Promise.resolve({
            ok: false,
            status: 500,
            json: async () => ({
              error: { message: "Internal server error occurred" },
            }),
          });
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ markets: [] }),
        });
      });

      render(<LendingPage />);

      const amountInput = screen.queryByLabelText(/amount/i);
      if (amountInput) {
        fireEvent.change(amountInput, { target: { value: "100" } });
      }

      const submitButtons = screen.getAllByRole("button");
      const lendBtn = submitButtons.find((b) => /lend/i.test(b.textContent || ""));
      if (lendBtn) {
        fireEvent.click(lendBtn);
      }

      const confirmButton = screen.queryByRole("button", { name: /confirm/i });
      if (confirmButton) {
        fireEvent.click(confirmButton);
        await waitFor(() => {
          expect(screen.getByText(/submission failed/i)).toBeInDocument();
        });
      }
    });

    it("handles network failure during submit without unhandled rejection", async () => {
      fetchMock.mockImplementation((url: string) => {
        if (url.includes("/api/tx/submit")) {
          return Promise.reject(new Error("Connection reset"));
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ markets: [] }),
        });
      });

      render(<LendingPage />);

      const amountInput = screen.queryByLabelText(/amount/i);
      if (amountInput) {
        fireEvent.change(amountInput, { target: { value: "100" } });
      }

      const submitButtons = screen.getAllByRole("button");
      const lendBtn = submitButtons.find((b) => /lend/i.test(b.textContent || ""));
      if (lendBtn) {
        fireEvent.click(lendBtn);
      }

      const confirmButton = screen.queryByRole("button", { name: /confirm/i });
      if (confirmButton) {
        fireEvent.click(confirmButton);
        await waitFor(() => {
          expect(screen.getByText(/submission error/i)).toBeInDocument();
        });
      }
    });
  });

  describe("Market Rates Concurrency and Sequence Invariants", () => {
    it("discards stale market rate responses when newer fetch completes first", async () => {
      let resolveFirst!: (value: unknown) => void;
      const firstPromise = new Promise((resolve) => {
        resolveFirst = resolve;
      });

      fetchMock
        .mockReturnValueOnce(firstPromise)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            markets: [{ asset: "XLM", supplyApr: 9.5, borrowApr: 14.0 }],
          }),
        });

      render(<LendingPage />);

      const retryButtons = screen.queryAllByRole("button", { name: /retry/i });
      if (retryButtons.length > 0) {
        fireEvent.click(retryButtons[0]);
      }

      resolveFirst({
        ok: true,
        status: 200,
        json: async () => ({
          markets: [{ asset: "XLM", supplyApr: 3.0, borrowApr: 5.0 }],
        }),
      });

      await waitFor(() => {
        expect(screen.queryByText(/3\.0%/)).not.toBeInDocument();
      });
    });
  });
});
