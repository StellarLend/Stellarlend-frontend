import React from "react";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextIntlClientProvider } from "next-intl";
import MarketsApp from "./markets-app";
import enMessages from "@/messages/en.json";

const replaceMock = vi.fn();
let currentSearchParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock }),
  usePathname: () => "/en/markets",
  useSearchParams: () => currentSearchParams,
}));

beforeEach(() => {
  replaceMock.mockReset();
  currentSearchParams = new URLSearchParams();
});

function renderMarketsApp() {
  return render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <MarketsApp />
    </NextIntlClientProvider>
  );
}

describe("MarketsApp Max buttons and Trade Preview", () => {
  it("opens trade modal and shows Max button", async () => {
    renderMarketsApp();

    // Click trade on XLM
    const tradeButtons = screen.getAllByRole("button", { name: "Trade" });
    fireEvent.click(tradeButtons[0]);

    // Trade modal should appear with mode buttons and Max button
    expect(screen.getByRole("button", { name: "Max" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirm Supply" })).toBeInTheDocument();
  });

  it("updates Before -> After preview when user types amount within 150ms", async () => {
    renderMarketsApp();

    const tradeButtons = screen.getAllByRole("button", { name: "Trade" });
    fireEvent.click(tradeButtons[0]); // XLM

    const input = screen.getByPlaceholderText("Amount in XLM");
    fireEvent.change(input, { target: { value: "100" } });

    // Preview should appear after debounce (< 150ms)
    await waitFor(
      () => {
        expect(screen.getByTestId("trade-preview")).toBeInTheDocument();
      },
      { timeout: 300 }
    );

    expect(screen.getByText("Projected Impact")).toBeInTheDocument();
    expect(screen.getByText("Borrow limit used")).toBeInTheDocument();
    expect(screen.getByText("Health factor")).toBeInTheDocument();
  });

  it("clicking Max fills the input field", async () => {
    renderMarketsApp();

    const tradeButtons = screen.getAllByRole("button", { name: "Trade" });
    fireEvent.click(tradeButtons[0]); // XLM

    // Switch to Borrow mode
    const borrowTab = screen.getByRole("button", { name: "Borrow" });
    fireEvent.click(borrowTab);

    const maxButton = screen.getByRole("button", { name: "Max" });
    fireEvent.click(maxButton);

    const input = screen.getByPlaceholderText("Amount in XLM") as HTMLInputElement;
    expect(input.value).toBe("0"); // With 0 collateral, max borrow is 0
  });

  it("disables Confirm button and displays danger alert when projected HF < 1.0", async () => {
    renderMarketsApp();

    const tradeButtons = screen.getAllByRole("button", { name: "Trade" });
    fireEvent.click(tradeButtons[0]); // XLM

    // Switch to Borrow mode with 0 collateral, any borrow amount is unsafe (limit 0, borrow > 0 -> HF = 0 < 1.0)
    const borrowTab = screen.getByRole("button", { name: "Borrow" });
    fireEvent.click(borrowTab);

    const input = screen.getByPlaceholderText("Amount in XLM");
    fireEvent.change(input, { target: { value: "50" } });

    await waitFor(
      () => {
        expect(screen.getByRole("alert")).toBeInTheDocument();
      },
      { timeout: 300 }
    );

    const confirmBtn = screen.getByRole("button", { name: "Confirm Borrow" });
    expect(confirmBtn).toBeDisabled();
    expect(
      screen.getByText(
        "Action would put your position below minimum health factor (< 1.0) and risk liquidation."
      )
    ).toBeInTheDocument();
  });

  it("shows warning when projected HF is between 1.0 and 1.2", async () => {
    // First supply some collateral so limit is positive
    renderMarketsApp();

    const tradeButtons = screen.getAllByRole("button", { name: "Trade" });
    fireEvent.click(tradeButtons[0]); // XLM

    // Supply 1000 XLM (@ $0.12, LTV 0.7 = $84 limit)
    const input = screen.getByPlaceholderText("Amount in XLM");
    fireEvent.change(input, { target: { value: "1000" } });
    const confirmSupply = screen.getByRole("button", { name: "Confirm Supply" });
    fireEvent.click(confirmSupply);

    // Now switch to borrow USDC
    const usdcTradeBtn = screen.getAllByRole("button", { name: "Trade" })[1];
    fireEvent.click(usdcTradeBtn);

    const borrowTab = screen.getByRole("button", { name: "Borrow" });
    fireEvent.click(borrowTab);

    // Limit is $84. Borrowing 75 USDC gives HF = 84 / 75 = 1.12 (between 1.0 and 1.2)
    const borrowInput = screen.getByPlaceholderText("Amount in USDC");
    fireEvent.change(borrowInput, { target: { value: "75" } });

    await waitFor(
      () => {
        expect(screen.getByRole("alert")).toBeInTheDocument();
      },
      { timeout: 300 }
    );

    expect(
      screen.getByText("Caution: Projected health factor is close to liquidation (< 1.2).")
    ).toBeInTheDocument();
    // Confirm should NOT be disabled for warning (only for unsafe < 1.0)
    const confirmBorrow = screen.getByRole("button", { name: "Confirm Borrow" });
    expect(confirmBorrow).not.toBeDisabled();
  });

  it("resets amount and preview on rapid mode switching", async () => {
    renderMarketsApp();

    const tradeButtons = screen.getAllByRole("button", { name: "Trade" });
    fireEvent.click(tradeButtons[0]); // XLM

    const input = screen.getByPlaceholderText("Amount in XLM") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "100" } });
    expect(input.value).toBe("100");

    // Switch mode
    const borrowTab = screen.getByRole("button", { name: "Borrow" });
    fireEvent.click(borrowTab);

    expect(input.value).toBe("");
    expect(screen.queryByTestId("trade-preview")).not.toBeInTheDocument();
  });
});

describe("MarketsApp search, sort, and position filter", () => {
  it("filters by symbol and syncs query param after 150ms debounce", async () => {
    renderMarketsApp();

    const search = screen.getByLabelText("Search markets");
    fireEvent.change(search, { target: { value: "btc" } });

    await waitFor(
      () => {
        expect(replaceMock).toHaveBeenCalledWith("/en/markets?q=btc", { scroll: false });
      },
      { timeout: 400 }
    );

    const table = screen.getByRole("table");
    const rows = within(table).getAllByRole("row").slice(1);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveTextContent("BTC");
  });

  it("sorts by borrow apy desc and updates URL", () => {
    renderMarketsApp();

    const sortSelect = screen.getByLabelText("Sort by");
    fireEvent.change(sortSelect, { target: { value: "borrowApy" } });

    expect(replaceMock).toHaveBeenCalledWith("/en/markets?sort=borrowApy", { scroll: false });

    const table = screen.getByRole("table");
    const rows = within(table).getAllByRole("row").slice(1);
    expect(rows.map((r) => r.querySelector("b")?.textContent)).toEqual([
      "USDC",
      "EURC",
      "XLM",
      "BTC",
    ]);
  });

  it("ignores unknown sort from URL and keeps default order", () => {
    currentSearchParams = new URLSearchParams("sort=nonexistent");
    renderMarketsApp();

    const sortSelect = screen.getByLabelText("Sort by") as HTMLSelectElement;
    expect(sortSelect.value).toBe("default");

    const table = screen.getByRole("table");
    const rows = within(table).getAllByRole("row").slice(1);
    expect(rows.map((r) => r.querySelector("b")?.textContent)).toEqual([
      "XLM",
      "USDC",
      "EURC",
      "BTC",
    ]);
  });

  it("restores query params on reload and shows localized empty state when no markets match", () => {
    currentSearchParams = new URLSearchParams("q=DOGE&mine=1");
    renderMarketsApp();

    expect((screen.getByLabelText("Search markets") as HTMLInputElement).value).toBe("DOGE");
    expect((screen.getByLabelText("My positions only") as HTMLInputElement).checked).toBe(true);
    expect(screen.getAllByText("No markets match your current filters.").length).toBeGreaterThan(0);
  });

  it("hides the health monitor chip when no wallet is connected", () => {
    renderMarketsApp();
    expect(screen.queryByTestId("health-chip")).not.toBeInTheDocument();
  });
});
