import { render, screen, fireEvent, act } from "@testing-library/react";
import MetricsCards from "@/components/features/dashboard/components/MetricsCards";

vi.mock("@/lib/utils/clipboard", () => ({
  copyToClipboard: vi.fn(),
}));

import { copyToClipboard } from "@/lib/utils/clipboard";

const MOCK_DATA = {
  availableBalance: "$3,750.00 XLM",
  copyAddress: "GABCDEF1234567890",
  borrowedAmount: "$1,500.00 XLM",
  nextDue: "$250.00 in 4 days",
  suppliedFunds: "$5,000.00 XLM",
  earnings: "$95.00 XLM",
  healthFactor: 1.5,
};

function mockFetch(data: object, ok = true) {
  global.fetch = vi.fn(() =>
    Promise.resolve({
      ok,
      statusText: ok ? "OK" : "Internal Server Error",
      json: () => Promise.resolve(data),
    }) as any,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
});

describe("MetricsCards", () => {
  describe("loading state", () => {
    it("renders skeleton cards while fetching", () => {
      // fetch never resolves during this test
      global.fetch = vi.fn(() => new Promise(() => {}));
      render(<MetricsCards />);
      // Skeletons are present; no h3 headings yet
      expect(screen.queryAllByRole("heading", { level: 3 })).toHaveLength(0);
      // The scrollable region and grid are still rendered
      expect(screen.getByRole("region", { name: /Scrollable metrics/i })).toBeTruthy();
    });
  });

  describe("error state", () => {
    it("renders fallback '—' cards on network error", async () => {
      global.fetch = vi.fn(() => Promise.reject(new Error("Network error")));
      render(<MetricsCards />);
      const cards = await screen.findAllByRole("heading", { level: 3 });
      expect(cards).toHaveLength(3);
      cards.forEach((card) => expect(card.textContent).toBe("—"));
    });

    it("renders fallback '—' cards on non-ok response", async () => {
      mockFetch({}, false);
      render(<MetricsCards />);
      const cards = await screen.findAllByRole("heading", { level: 3 });
      cards.forEach((card) => expect(card.textContent).toBe("—"));
    });
  });

  describe("zero / empty positions", () => {
    it("falls back to '$0.00' placeholders when fields are missing", async () => {
      mockFetch({});
      render(<MetricsCards />);
      const cards = await screen.findAllByRole("heading", { level: 3 });
      expect(cards).toHaveLength(3);
      expect(cards[0].textContent).toBe("$0.00");
      expect(cards[1].textContent).toBe("$0.00");
      expect(cards[2].textContent).toBe("$0.00");
    });
  });

  describe("live data", () => {
    it("renders three metric cards with live values from /api/positions", async () => {
      mockFetch(MOCK_DATA);
      render(<MetricsCards />);

      expect(await screen.findByText("$3,750.00 XLM")).toBeTruthy();
      expect(screen.getByText("$1,500.00 XLM")).toBeTruthy();
      expect(screen.getByText("$5,000.00 XLM")).toBeTruthy();
    });

    it("renders health factor in the supplied card label", async () => {
      mockFetch(MOCK_DATA);
      render(<MetricsCards />);
      expect(await screen.findByText(/Health Factor: 1\.5/i)).toBeTruthy();
    });

    it("renders sub-values: next due and earnings", async () => {
      mockFetch(MOCK_DATA);
      render(<MetricsCards />);
      expect(await screen.findByText("$250.00 in 4 days")).toBeTruthy();
      expect(screen.getByText("$95.00 XLM")).toBeTruthy();
    });

    it("renders responsive grid classes", async () => {
      mockFetch(MOCK_DATA);
      render(<MetricsCards />);
      await screen.findAllByRole("heading", { level: 3 });
      // ScrollCues renders: <div role="region"> → <div class="overflow-x-auto"> → {grid}
      const scrollWrapper = screen.getByRole("region", { name: /Scrollable metrics/i })
        .firstChild as HTMLElement;
      const grid = scrollWrapper.firstChild as HTMLElement;
      expect(grid).toHaveClass("grid", "grid-cols-1", "sm:grid-cols-2", "lg:grid-cols-3");
    });
  });

  describe("copy address behaviour", () => {
    it("calls clipboard helper with the wallet address", async () => {
      mockFetch(MOCK_DATA);
      const mockCopy = vi.mocked(copyToClipboard).mockResolvedValue({ success: true });
      render(<MetricsCards />);

      const copyBtn = await screen.findByRole("button", { name: /Copy address to clipboard/i });
      await act(() => fireEvent.click(copyBtn));

      expect(mockCopy).toHaveBeenCalledWith("GABCDEF1234567890", true);
    });

    it("shows 'Copied!' feedback and clears after 2 s", async () => {
      mockFetch(MOCK_DATA);
      vi.mocked(copyToClipboard).mockResolvedValue({ success: true });

      render(<MetricsCards />);
      // Wait for data to load with real timers before switching to fake timers
      const copyBtn = await screen.findByRole("button", { name: /Copy address to clipboard/i });

      vi.useFakeTimers();
      await act(() => fireEvent.click(copyBtn));
      expect(screen.getByText("Copied!")).toBeTruthy();
      act(() => vi.advanceTimersByTime(2000));
      expect(screen.queryByText("Copied!")).toBeNull();
      vi.useRealTimers();
    });

    it("shows error toast for invalid_address failure", async () => {
      mockFetch(MOCK_DATA);
      vi.mocked(copyToClipboard).mockResolvedValue({ success: false, reason: "invalid_address" });
      render(<MetricsCards />);

      const copyBtn = await screen.findByRole("button", { name: /Copy address to clipboard/i });
      await act(() => fireEvent.click(copyBtn));

      expect(screen.getByText("Invalid Address")).toBeTruthy();
      expect(
        screen.getByText("The wallet address could not be validated before copying."),
      ).toBeTruthy();
    });

    it("shows error toast for clipboard_error failure", async () => {
      mockFetch(MOCK_DATA);
      vi.mocked(copyToClipboard).mockResolvedValue({ success: false, reason: "clipboard_error" });
      render(<MetricsCards />);

      const copyBtn = await screen.findByRole("button", { name: /Copy address to clipboard/i });
      await act(() => fireEvent.click(copyBtn));

      expect(screen.getByText("Copy Failed")).toBeTruthy();
      expect(
        screen.getByText("Clipboard access is unavailable. Try copying the address manually."),
      ).toBeTruthy();
    });

    it("does not show copy button when copyAddress is absent", async () => {
      mockFetch({ ...MOCK_DATA, copyAddress: "" });
      render(<MetricsCards />);
      await screen.findAllByRole("heading", { level: 3 });
      expect(screen.queryByRole("button", { name: /Copy address to clipboard/i })).toBeNull();
    });
  });
});
