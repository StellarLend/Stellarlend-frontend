import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AssetSelector from "../AssetSelector";
import { ASSETS } from "@/lib/assets";
import { resetPricesCache } from "@/hooks/usePrices";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("AssetSelector", () => {
  beforeEach(() => {
    resetPricesCache();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          prices: { XLM: 0.12, USDC: 1, BTC: 65000, ETH: 3500 },
          timestamp: new Date().toISOString(),
          source: "test",
        }),
      }),
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders trigger with the selected asset and toggles dropdown on click", async () => {
    render(<AssetSelector assets={ASSETS} value="XLM" onChange={() => {}} />);

    // Initially, trigger is shown, and other assets are not visible
    const trigger = screen.getByRole("button", { name: /Asset selector/i });
    expect(trigger).toBeInTheDocument();
    expect(screen.getByText("XLM")).toBeInTheDocument();
    expect(screen.queryByText("USDC")).toBeNull();

    // Click to open
    await userEvent.click(trigger);

    // Now all options are rendered inside the listbox
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    expect(screen.getByText("USDC")).toBeInTheDocument();
    expect(screen.getByText("BTC")).toBeInTheDocument();
    expect(screen.getByText("ETH")).toBeInTheDocument();
  });

  it("calls onChange when an asset is clicked from the open dropdown", async () => {
    const onChange = vi.fn();
    render(<AssetSelector assets={ASSETS} value="XLM" onChange={onChange} />);

    const trigger = screen.getByRole("button", { name: /Asset selector/i });
    await userEvent.click(trigger);

    const btcOption = screen.getByRole("option", { name: /BTC/i });
    await userEvent.click(btcOption);

    expect(onChange).toHaveBeenCalledWith("BTC");
    expect(screen.queryByRole("listbox")).toBeNull(); // dropdown closes on select
  });

  it("supports keyboard search filtering", async () => {
    render(<AssetSelector assets={ASSETS} value="XLM" onChange={() => {}} />);

    const trigger = screen.getByRole("button", { name: /Asset selector/i });
    await userEvent.click(trigger);

    const searchInput = screen.getByLabelText(/Search assets/i);
    await userEvent.type(searchInput, "bt");

    // BTC matches "bt", but ETH, USDC, XLM do not
    expect(screen.getByText("BTC")).toBeInTheDocument();
    expect(screen.queryByText("USDC")).toBeNull();
    expect(screen.queryByText("ETH")).toBeNull();
  });

  it("displays empty results message for non-matching search", async () => {
    render(<AssetSelector assets={ASSETS} value="XLM" onChange={() => {}} />);

    const trigger = screen.getByRole("button", { name: /Asset selector/i });
    await userEvent.click(trigger);

    const searchInput = screen.getByLabelText(/Search assets/i);
    await userEvent.type(searchInput, "xyz");

    expect(screen.getByText("No assets found")).toBeInTheDocument();
  });

  it("supports full keyboard navigation (arrows, Enter, Escape)", async () => {
    const onChange = vi.fn();
    render(<AssetSelector assets={ASSETS} value="XLM" onChange={onChange} />);

    const trigger = screen.getByRole("button", { name: /Asset selector/i });
    trigger.focus();

    // Open via Enter key on trigger
    fireEvent.keyDown(trigger, { key: "Enter" });
    expect(screen.getByRole("listbox")).toBeInTheDocument();

    const searchInput = screen.getByLabelText(/Search assets/i);
    expect(document.activeElement).toBe(searchInput);

    // Press ArrowDown to highlight first filtered asset (XLM)
    fireEvent.keyDown(searchInput, { key: "ArrowDown" });
    // Press ArrowDown to highlight second filtered asset (USDC)
    fireEvent.keyDown(searchInput, { key: "ArrowDown" });
    // Press ArrowDown to highlight third filtered asset (BTC)
    fireEvent.keyDown(searchInput, { key: "ArrowDown" });

    // Press Enter to select highlighted asset (BTC)
    fireEvent.keyDown(searchInput, { key: "Enter" });
    expect(onChange).toHaveBeenCalledWith("BTC");
    expect(screen.queryByRole("listbox")).toBeNull(); // closes on select

    // Reopen and test Escape key to close
    await userEvent.click(trigger);
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    
    const searchInput2 = screen.getByLabelText(/Search assets/i);
    fireEvent.keyDown(searchInput2, { key: "Escape" });
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("announces selections and results to assistive technologies", async () => {
    render(<AssetSelector assets={ASSETS} value="XLM" onChange={() => {}} />);

    const trigger = screen.getByRole("button", { name: /Asset selector/i });
    await userEvent.click(trigger);

    const searchInput = screen.getByLabelText(/Search assets/i);
    await userEvent.type(searchInput, "bt");

    // The live region should announce the results
    const liveRegion = screen.getByRole("status");
    expect(liveRegion).toHaveTextContent(/1 assets found for "bt"/i);
  });
});
