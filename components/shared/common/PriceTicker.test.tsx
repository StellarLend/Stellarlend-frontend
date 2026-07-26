// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { screen, render } from "@/test/test-utils";
import PriceTicker from "./PriceTicker";
import type { PricedAsset } from "@/hooks/usePriceStream";

vi.mock("@/hooks/usePriceStream", () => ({
  default: vi.fn(),
}));

vi.mock("@/hooks/useReducedMotion", () => ({
  useReducedMotion: vi.fn(() => false),
}));

import usePriceStream from "@/hooks/usePriceStream";
import { useReducedMotion } from "@/hooks/useReducedMotion";

const mockUsePriceStream = vi.mocked(usePriceStream);
const mockUseReducedMotion = vi.mocked(useReducedMotion);

function createMockPrices(entries: [string, PricedAsset][]): Map<string, PricedAsset> {
  return new Map(entries);
}

describe("PriceTicker", () => {
  beforeEach(() => {
    mockUseReducedMotion.mockReturnValue(false);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders loading state when no prices received yet", () => {
    mockUsePriceStream.mockReturnValue({
      prices: createMockPrices([]),
      isLoading: true,
    });

    render(<PriceTicker />);

    expect(screen.getByText("Loading prices...")).toBeInTheDocument();
  });

  it("renders 'No prices available' when prices map is empty after loading", () => {
    mockUsePriceStream.mockReturnValue({
      prices: createMockPrices([]),
      isLoading: false,
    });

    render(<PriceTicker />);

    expect(screen.getByText("No prices available")).toBeInTheDocument();
  });

  it("renders asset symbols and prices", () => {
    const mockPrices = createMockPrices([
      [
        "XLM",
        {
          symbol: "XLM",
          price: 0.1245,
          direction: "unchanged",
          timestamp: "2026-06-28T10:00:00.000Z",
        },
      ],
      [
        "BTC",
        {
          symbol: "BTC",
          price: 67340.5,
          direction: "unchanged",
          timestamp: "2026-06-28T10:00:00.000Z",
        },
      ],
      [
        "ETH",
        {
          symbol: "ETH",
          price: 3480.2,
          direction: "unchanged",
          timestamp: "2026-06-28T10:00:00.000Z",
        },
      ],
      [
        "USDC",
        {
          symbol: "USDC",
          price: 1.0,
          direction: "unchanged",
          timestamp: "2026-06-28T10:00:00.000Z",
        },
      ],
    ]);

    mockUsePriceStream.mockReturnValue({
      prices: mockPrices,
      isLoading: false,
    });

    render(<PriceTicker />);

    expect(screen.getByText("BTC")).toBeInTheDocument();
    expect(screen.getByText("XLM")).toBeInTheDocument();
    expect(screen.getByText("ETH")).toBeInTheDocument();
    expect(screen.getByText("USDC")).toBeInTheDocument();
    expect(screen.getByText("67,340.50")).toBeInTheDocument();
    expect(screen.getByText("0.1245")).toBeInTheDocument();
    expect(screen.getByText("1.00")).toBeInTheDocument();
  });

  it("renders price with direction indicators", () => {
    const mockPrices = createMockPrices([
      [
        "XLM",
        {
          symbol: "XLM",
          price: 0.13,
          direction: "up",
          timestamp: "2026-06-28T10:00:00.000Z",
        },
      ],
      [
        "ETH",
        {
          symbol: "ETH",
          price: 3400,
          direction: "down",
          timestamp: "2026-06-28T10:00:00.000Z",
        },
      ],
      [
        "USDC",
        {
          symbol: "USDC",
          price: 1.0,
          direction: "unchanged",
          timestamp: "2026-06-28T10:00:00.000Z",
        },
      ],
    ]);

    mockUsePriceStream.mockReturnValue({
      prices: mockPrices,
      isLoading: false,
    });

    const { container } = render(<PriceTicker />);

    const directionIndicators = container.querySelectorAll("span");
    const upIndicator = Array.from(directionIndicators).find((s) =>
      s.className.includes("bg-green-500"),
    );
    const downIndicator = Array.from(directionIndicators).find((s) =>
      s.className.includes("bg-red-500"),
    );
    const unchangedIndicator = Array.from(directionIndicators).find((s) =>
      s.className.includes("bg-slate-300"),
    );

    expect(upIndicator).not.toBeUndefined();
    expect(downIndicator).not.toBeUndefined();
    expect(unchangedIndicator).not.toBeUndefined();
  });

  it("applies reduced motion class when prefers-reduced-motion is true", () => {
    mockUseReducedMotion.mockReturnValue(true);
    const mockPrices = createMockPrices([
      [
        "XLM",
        {
          symbol: "XLM",
          price: 0.1245,
          direction: "unchanged",
          timestamp: "2026-06-28T10:00:00.000Z",
        },
      ],
    ]);

    mockUsePriceStream.mockReturnValue({
      prices: mockPrices,
      isLoading: false,
    });

    const { container } = render(<PriceTicker />);

    const nav = container.querySelector("nav");
    expect(nav?.className).not.toContain("transition-opacity");
  });

  it("has accessible aria-label on nav element", () => {
    const mockPrices = createMockPrices([
      [
        "XLM",
        {
          symbol: "XLM",
          price: 0.1245,
          direction: "unchanged",
          timestamp: "2026-06-28T10:00:00.000Z",
        },
      ],
    ]);

    mockUsePriceStream.mockReturnValue({
      prices: mockPrices,
      isLoading: false,
    });

    render(<PriceTicker />);

    const nav = screen.getByRole("navigation", { name: "Live market prices" });
    expect(nav).toBeInTheDocument();
  });

  it("has aria-labels on individual price items describing symbol and price", () => {
    const mockPrices = createMockPrices([
      [
        "XLM",
        {
          symbol: "XLM",
          price: 0.1245,
          direction: "up",
          timestamp: "2026-06-28T10:00:00.000Z",
        },
      ],
    ]);

    mockUsePriceStream.mockReturnValue({
      prices: mockPrices,
      isLoading: false,
    });

    render(<PriceTicker />);

    const priceItem = screen.getByLabelText(/XLM price: 0\.1245/);
    expect(priceItem).toBeInTheDocument();
  });

  it("accepts and applies custom className", () => {
    mockUsePriceStream.mockReturnValue({
      prices: createMockPrices([] as [string, PricedAsset][]),
      isLoading: true,
    });

    const { container } = render(<PriceTicker className="custom-class" />);

    const ticker = container.firstChild;
    expect(ticker?.classList.contains("custom-class")).toBe(true);
  });

  it("sorts prices by symbol alphabetically", () => {
    const mockPrices = createMockPrices([
      [
        "ETH",
        {
          symbol: "ETH",
          price: 3480.2,
          direction: "up",
          timestamp: "2026-06-28T10:00:00.000Z",
        },
      ],
      [
        "XLM",
        {
          symbol: "XLM",
          price: 0.1245,
          direction: "down",
          timestamp: "2026-06-28T10:00:00.000Z",
        },
      ],
    ]);

    mockUsePriceStream.mockReturnValue({
      prices: mockPrices,
      isLoading: false,
    });

    const { container } = render(<PriceTicker />);

    const symbols = container.querySelectorAll("span.font-medium");
    const symbolTexts = Array.from(symbols).map((s) => s.textContent);

    expect(symbolTexts).toEqual(["ETH", "XLM"]);
  });
});