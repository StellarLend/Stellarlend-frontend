import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import axe from "axe-core";
import { render, screen, waitFor } from "@/test/test-utils";
import LendingPage from "./page";

const hexToRgb = (hex: string) => {
  const normalized = hex.replace("#", "");
  const value = normalized.length === 3
    ? normalized.split("").map((char) => char + char).join("")
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
  const lighter = Math.max(getRelativeLuminance(foreground), getRelativeLuminance(background));
  const darker = Math.min(getRelativeLuminance(foreground), getRelativeLuminance(background));

  return (lighter + 0.05) / (darker + 0.05);
};

describe("LendingPage", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        markets: [
          { asset: "XLM", supplyApr: 7.2, borrowApr: 11.4 },
        ],
      }),
    });

    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  it("keeps the lending header on a light surface with accessible contrast", async () => {
    render(<LendingPage />);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/markets?asset=XLM", expect.any(Object)));

    const heading = screen.getByRole("heading", { name: "Lending & Borrowing" });
    const headerSurface = heading.closest("section");
    expect(headerSurface).toHaveClass("bg-white/95");
    expect(heading).toHaveClass("text-slate-900");

    const description = screen.getByText(
      "Earn interest by lending your assets or borrow against your collateral."
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
});
