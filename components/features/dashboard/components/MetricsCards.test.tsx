import { render, screen, fireEvent, act } from "@testing-library/react";
import MetricsCards from "@/components/features/dashboard/components/MetricsCards";

vi.mock("@/lib/utils/clipboard", () => ({
  copyToClipboard: vi.fn(),
}));

import { copyToClipboard } from "@/lib/utils/clipboard";

// Mock fetch for metric data
global.fetch = vi.fn(() =>
  Promise.resolve({
    json: () =>
      Promise.resolve({
        availableBalance: "1,000 XLM",
        copyAddress: "GABCDEF1234567890",
        borrowedAmount: "500 XLM",
        nextDue: "2024-12-31",
        suppliedFunds: "2,000 XLM",
        healthFactor: "1.5",
        earnings: "50 XLM",
      }),
  }) as any,
);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("MetricsCards", () => {
  test("renders three metric cards and uses responsive grid classes", async () => {
    render(<MetricsCards />);

    const cards = await screen.findAllByRole("heading", { level: 3 });
    expect(cards).toHaveLength(3);

    const grid = screen.getByRole("region", {
      name: /Scrollable metrics/i,
    }).firstChild as HTMLElement;
    expect(grid).toHaveClass(
      "grid",
      "grid-cols-1",
      "sm:grid-cols-2",
      "lg:grid-cols-3",
    );
  });

  test("copy button calls clipboard helper with validation", async () => {
    const mockCopy = vi.mocked(copyToClipboard).mockResolvedValue({
      success: true,
    });

    render(<MetricsCards />);

    const copyBtn = await screen.findByRole("button", {
      name: /Copy address to clipboard/i,
    });
    await act(() => fireEvent.click(copyBtn));

    expect(mockCopy).toHaveBeenCalledWith("GABCDEF1234567890", true);
  });

  test("shows 'Copied!' feedback on successful copy", async () => {
    vi.mocked(copyToClipboard).mockResolvedValue({ success: true });
    vi.useFakeTimers();

    render(<MetricsCards />);

    const copyBtn = await screen.findByRole("button", {
      name: /Copy address to clipboard/i,
    });
    await act(() => fireEvent.click(copyBtn));

    expect(screen.getByText("Copied!")).toBeTruthy();

    act(() => vi.advanceTimersByTime(2000));
    expect(screen.queryByText("Copied!")).toBeNull();

    vi.useRealTimers();
  });

  test("shows error toast when clipboard fails", async () => {
    vi.mocked(copyToClipboard).mockResolvedValue({
      success: false,
      reason: "invalid_address",
    });

    render(<MetricsCards />);

    const copyBtn = await screen.findByRole("button", {
      name: /Copy address to clipboard/i,
    });
    await act(() => fireEvent.click(copyBtn));

    expect(screen.getByText("Invalid Address")).toBeTruthy();
    expect(
      screen.getByText("The wallet address could not be validated before copying."),
    ).toBeTruthy();
  });

  test("shows error toast for clipboard_error reason", async () => {
    vi.mocked(copyToClipboard).mockResolvedValue({
      success: false,
      reason: "clipboard_error",
    });

    render(<MetricsCards />);

    const copyBtn = await screen.findByRole("button", {
      name: /Copy address to clipboard/i,
    });
    await act(() => fireEvent.click(copyBtn));

    expect(screen.getByText("Copy Failed")).toBeTruthy();
    expect(
      screen.getByText(
        "Clipboard access is unavailable. Try copying the address manually.",
      ),
    ).toBeTruthy();
  });
});
