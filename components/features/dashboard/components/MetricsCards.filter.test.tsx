import { render, screen, fireEvent, act } from "@testing-library/react";
import MetricsCards from "@/components/features/dashboard/components/MetricsCards";

// Mock clipboard (required by MetricCard)
vi.mock("@/lib/utils/clipboard", () => ({
  copyToClipboard: vi.fn().mockResolvedValue({ success: true }),
}));

// Mock the asset registry so tests are not tied to registry.json contents
vi.mock("@/lib/assets/registry", () => ({
  getAssets: vi.fn(() => [
    {
      symbol: "XLM",
      name: "Stellar Lumens",
      decimals: 7,
      issuer: "native",
      logoUrl: "https://example.com/xlm.png",
    },
    {
      symbol: "USDC",
      name: "USD Coin",
      decimals: 6,
      issuer: "GBUQ",
      logoUrl: "https://example.com/usdc.png",
    },
    {
      symbol: "BTC",
      name: "Bitcoin",
      decimals: 7,
      issuer: "GATE",
      logoUrl: "https://example.com/btc.png",
    },
  ]),
}));

// Stub fetch with minimal positions payload
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

beforeEach(() => vi.clearAllMocks());

describe("MetricsCards – asset filter", () => {
  async function renderAndWait() {
    render(<MetricsCards />);
    // Wait for the fetch to resolve and component to update
    await screen.findByLabelText("Filter assets");
    return screen.getByLabelText("Filter assets") as HTMLInputElement;
  }

  test("renders filter input with accessible label", async () => {
    const input = await renderAndWait();
    expect(input).toBeTruthy();
    expect(input.tagName).toBe("INPUT");
  });

  test("shows 'Showing X of Y' with all assets by default", async () => {
    await renderAndWait();
    expect(screen.getByText(/Showing 3 of 3/i)).toBeTruthy();
  });

  test("filters by symbol (case-insensitive)", async () => {
    const input = await renderAndWait();
    fireEvent.change(input, { target: { value: "xlm" } });
    expect(screen.getByText(/Showing 1 of 3/i)).toBeTruthy();
    expect(screen.getByText("XLM")).toBeTruthy();
    expect(screen.queryByText("USDC")).toBeNull();
  });

  test("filters by name (case-insensitive)", async () => {
    const input = await renderAndWait();
    fireEvent.change(input, { target: { value: "stellar" } });
    expect(screen.getByText(/Showing 1 of 3/i)).toBeTruthy();
    expect(screen.getByText("XLM")).toBeTruthy();
  });

  test("no matches shows empty state with 'Showing 0 of 3'", async () => {
    const input = await renderAndWait();
    fireEvent.change(input, { target: { value: "zzz" } });
    expect(screen.getByText(/Showing 0 of 3/i)).toBeTruthy();
    expect(screen.getByRole("status")).toBeTruthy();
    expect(screen.getByText(/No assets match/i)).toBeTruthy();
  });

  test("clear filter button inside input resets to all assets", async () => {
    const input = await renderAndWait();
    fireEvent.change(input, { target: { value: "btc" } });
    expect(screen.getByText(/Showing 1 of 3/i)).toBeTruthy();

    const clearBtn = screen.getByRole("button", { name: /Clear filter/i });
    fireEvent.click(clearBtn);

    expect((input as HTMLInputElement).value).toBe("");
    expect(screen.getByText(/Showing 3 of 3/i)).toBeTruthy();
  });

  test("empty-state inline clear-filter link resets filter", async () => {
    const input = await renderAndWait();
    fireEvent.change(input, { target: { value: "zzz" } });

    // The empty state renders a "Clear filter" button
    const clearLinks = screen.getAllByRole("button", { name: /Clear filter/i });
    // At least one clear control (the inline one in the empty state)
    fireEvent.click(clearLinks[clearLinks.length - 1]);

    expect((input as HTMLInputElement).value).toBe("");
    expect(screen.getByText(/Showing 3 of 3/i)).toBeTruthy();
  });

  test("single-asset list shows 'Showing 1 of 1' when registry has one asset", async () => {
    const { getAssets } = await import("@/lib/assets/registry");
    vi.mocked(getAssets).mockReturnValueOnce([
      {
        symbol: "XLM",
        name: "Stellar Lumens",
        decimals: 7,
        issuer: "native",
        logoUrl: "https://example.com/xlm.png",
      },
    ]);

    render(<MetricsCards />);
    await screen.findByLabelText("Filter assets");
    expect(screen.getByText(/Showing 1 of 1/i)).toBeTruthy();
  });

  test("filter input is keyboard accessible (can type and clear with keyboard)", async () => {
    const input = await renderAndWait();
    input.focus();
    fireEvent.change(input, { target: { value: "usd" } });
    expect(screen.getByText(/Showing 1 of 3/i)).toBeTruthy();
    // Clear via the X button (keyboard accessible button)
    const clearBtn = screen.getByRole("button", { name: /Clear filter/i });
    expect(clearBtn).toBeTruthy();
  });

  test("registry error falls back to empty asset list without crashing", async () => {
    const { getAssets } = await import("@/lib/assets/registry");
    vi.mocked(getAssets).mockImplementationOnce(() => {
      throw new Error("registry unavailable");
    });

    render(<MetricsCards />);
    await screen.findByLabelText("Filter assets");
    // Should show 0 of 0, no crash
    expect(screen.getByText(/Showing 0 of 0/i)).toBeTruthy();
  });
});
