import React from "react";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NextIntlClientProvider } from "next-intl";
import messages from "@/messages/en.json";

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const mocks = vi.hoisted(() => ({
  // wallet
  walletAddress: null as string | null,
  // liquidation lib
  getBorrowerPosition: vi.fn(),
  getLiquidationParams: vi.fn(),
  isPositionLiquidatable: vi.fn(),
  previewLiquidation: vi.fn(),
  // tx lib
  executeLiquidation: vi.fn(),
}));

vi.mock("@/components/wallet", () => ({
  useWallet: () => ({
    address: mocks.walletAddress,
    signTransaction: vi.fn(),
    connect: vi.fn(),
    disconnect: vi.fn(),
    balance: null,
    error: null,
  }),
  ConnectButton: () => <button>Connect</button>,
}));

vi.mock("@/lib/liquidation", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/liquidation")>();
  return {
    ...actual,
    getBorrowerPosition: mocks.getBorrowerPosition,
    getLiquidationParams: mocks.getLiquidationParams,
    isPositionLiquidatable: mocks.isPositionLiquidatable,
    previewLiquidation: mocks.previewLiquidation,
  };
});

vi.mock("@/lib/tx", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/tx")>();
  return {
    ...actual,
    executeLiquidation: mocks.executeLiquidation,
  };
});

vi.mock("@/lib/config", () => ({
  config: {
    rpc: "https://rpc.example.com",
    networkPassphrase: "Test SDF Network ; September 2015",
    lendingId: "",
    marketAssets: {},
  },
  txExplorer: (hash: string) => `https://stellar.expert/explorer/testnet/tx/${hash}`,
  explorer: { tx: (h: string) => `https://stellar.expert/explorer/testnet/tx/${h}` },
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

import LiquidatePanel from "./liquidate-panel";
import type { BorrowerPosition, LiquidationParams } from "@/lib/liquidation";

const VALID_BORROWER =
  "GA5WUJ54Z23KILLCUOUNAKTPBVZWKMQVO4O6EQ5GHLAERIMLLHNCSKYH";
const WALLET_ADDRESS =
  "GBVTJNPUQO2DFKPGFXP2FXCM3BHNZIQVBFDABQ7AXPUOEPQZQLZLVH2";

const defaultPosition: BorrowerPosition = {
  collateralAmount: 10_000_000n,
  debtAmount: 8_000_000n,
  healthFactor: 7_500n, // below 10 000 → unhealthy
  lastUpdateTimestamp: 0,
};

const defaultParams: LiquidationParams = {
  liquidationThresholdBps: 8_000n,
  closeFactorBps: 5_000n,
  liquidationIncentiveBps: 500n,
  gracePeriodSeconds: 0,
};

// ---------------------------------------------------------------------------
// Render helpers
// ---------------------------------------------------------------------------

function makeClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
}

function Wrapper({
  children,
  client,
}: {
  children: React.ReactNode;
  client: QueryClient;
}) {
  return (
    <QueryClientProvider client={client}>
      <NextIntlClientProvider locale="en" messages={messages}>
        {children}
      </NextIntlClientProvider>
    </QueryClientProvider>
  );
}

function renderPanel(client = makeClient()) {
  return render(
    <Wrapper client={client}>
      <LiquidatePanel />
    </Wrapper>,
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  mocks.walletAddress = WALLET_ADDRESS;
  mocks.getBorrowerPosition.mockResolvedValue(defaultPosition);
  mocks.getLiquidationParams.mockResolvedValue(defaultParams);
  mocks.isPositionLiquidatable.mockReturnValue({ liquidatable: true });
  mocks.previewLiquidation.mockReturnValue({
    actualRepay: 3_000_000n,
    seizedEstimate: 3_315_000n,
  });
  mocks.executeLiquidation.mockResolvedValue({ hash: "abc123", status: "success" });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// ----- Address validation -----

describe("address validation", () => {
  it("shows an inline error for an invalid G-address", async () => {
    renderPanel();

    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "not-a-stellar-address" } });
    fireEvent.click(screen.getByRole("button", { name: /look up/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /valid G-address/i,
    );
    expect(mocks.getBorrowerPosition).not.toHaveBeenCalled();
  });

  it("does not show an error for a valid G-address", async () => {
    renderPanel();

    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: VALID_BORROWER } });
    fireEvent.click(screen.getByRole("button", { name: /look up/i }));

    await waitFor(() =>
      expect(mocks.getBorrowerPosition).toHaveBeenCalledWith(VALID_BORROWER),
    );
    expect(screen.queryByText(/valid G-address/i)).toBeNull();
  });
});

// ----- Position display -----

describe("position display", () => {
  it("renders decoded position fields after a successful lookup", async () => {
    renderPanel();

    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: VALID_BORROWER } });
    fireEvent.click(screen.getByRole("button", { name: /look up/i }));

    expect(await screen.findByText("Position")).toBeInTheDocument();
    // Collateral: 10_000_000 base units → fromBaseUnits trims trailing zeros → "1"
    expect(screen.getByText("1")).toBeInTheDocument();
    // Health factor: 7500 → "0.7500"
    expect(screen.getByText("0.7500")).toBeInTheDocument();
    // Close factor: 5000 bps → "50.00 %"
    expect(screen.getByText("50.00 %")).toBeInTheDocument();
    // Incentive: 500 bps → "5.00 %"
    expect(screen.getByText("5.00 %")).toBeInTheDocument();
  });

  it("shows the not-liquidatable notice when isPositionLiquidatable returns false", async () => {
    mocks.isPositionLiquidatable.mockReturnValue({
      liquidatable: false,
      reason: "Position is healthy",
    });
    renderPanel();

    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: VALID_BORROWER } });
    fireEvent.click(screen.getByRole("button", { name: /look up/i }));

    expect(
      await screen.findByText(/healthy and cannot be liquidated/i),
    ).toBeInTheDocument();
    // Repay input must not be shown
    expect(screen.queryByLabelText(/repay amount/i)).toBeNull();
  });

  it("renders the repay input when the position is liquidatable", async () => {
    renderPanel();

    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: VALID_BORROWER } });
    fireEvent.click(screen.getByRole("button", { name: /look up/i }));

    expect(
      await screen.findByLabelText(/repay amount/i),
    ).toBeInTheDocument();
  });
});

// ----- Disconnected state -----

describe("disconnected wallet", () => {
  it("shows connect-wallet prompt instead of the submit button", async () => {
    mocks.walletAddress = null;
    renderPanel();

    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: VALID_BORROWER } });
    fireEvent.click(screen.getByRole("button", { name: /look up/i }));

    await screen.findByLabelText(/repay amount/i);

    expect(
      screen.getByText(/connect wallet to liquidate/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /liquidate/i }),
    ).toBeNull();
  });
});

// ----- Amount validation -----

describe("repay amount validation", () => {
  async function setupWithPosition() {
    renderPanel();
    const borrowerInput = screen.getByRole("textbox");
    fireEvent.change(borrowerInput, { target: { value: VALID_BORROWER } });
    fireEvent.click(screen.getByRole("button", { name: /look up/i }));
    await screen.findByLabelText(/repay amount/i);
  }

  it("shows an error when the repay amount exceeds the close-factor cap", async () => {
    await setupWithPosition();

    // maxRepay = 8_000_000 * 5000 / 10000 = 4_000_000 base units → "0.4000000"
    // Enter something larger: 1 XLM = 10_000_000 base units → "> max"
    const repayInput = screen.getByLabelText(/repay amount/i);
    fireEvent.change(repayInput, { target: { value: "1" } });

    expect(
      await screen.findByText(/exceeds the close-factor cap/i),
    ).toBeInTheDocument();
  });

  it("submit button is disabled when amount exceeds cap", async () => {
    await setupWithPosition();

    const repayInput = screen.getByLabelText(/repay amount/i);
    fireEvent.change(repayInput, { target: { value: "1" } });

    await screen.findByText(/exceeds the close-factor cap/i);

    const submitBtn = screen.queryByRole("button", { name: /liquidate/i });
    expect(submitBtn).toBeDisabled();
  });

  it("Max repay button fills the input with the capped amount", async () => {
    await setupWithPosition();

    fireEvent.click(screen.getByRole("button", { name: /max repay/i }));

    const repayInput = screen.getByLabelText(/repay amount/i) as HTMLInputElement;
    // maxRepay = 4_000_000 → fromBaseUnits trims trailing zeros → "0.4"
    expect(repayInput.value).toBe("0.4");
  });
});

// ----- Preview -----

describe("liquidation preview", () => {
  it("shows actualRepay and seizedEstimate when a valid amount is entered", async () => {
    renderPanel();
    const borrowerInput = screen.getByRole("textbox");
    fireEvent.change(borrowerInput, { target: { value: VALID_BORROWER } });
    fireEvent.click(screen.getByRole("button", { name: /look up/i }));
    await screen.findByLabelText(/repay amount/i);

    const repayInput = screen.getByLabelText(/repay amount/i);
    fireEvent.change(repayInput, { target: { value: "0.3000000" } });

    // Preview values come from mocks.previewLiquidation
    // actualRepay: 3_000_000 → fromBaseUnits trims trailing zeros → "0.3"
    // seizedEstimate: 3_315_000 → "0.3315"
    await waitFor(() =>
      expect(screen.getByText("0.3")).toBeInTheDocument(),
    );
    expect(screen.getByText("0.3315")).toBeInTheDocument();
  });
});

// ----- Submission -----

describe("submission flow", () => {
  async function setupAndSubmit(amount = "0.3000000") {
    renderPanel();
    const borrowerInput = screen.getByRole("textbox");
    fireEvent.change(borrowerInput, { target: { value: VALID_BORROWER } });
    fireEvent.click(screen.getByRole("button", { name: /look up/i }));
    await screen.findByLabelText(/repay amount/i);
    fireEvent.change(screen.getByLabelText(/repay amount/i), {
      target: { value: amount },
    });
    await waitFor(() =>
      expect(
        screen.queryByText(/exceeds the close-factor cap/i),
      ).toBeNull(),
    );
    fireEvent.click(screen.getByRole("button", { name: /liquidate/i }));
  }

  it("renders a tx-hash explorer link after a successful submission", async () => {
    await setupAndSubmit();

    const link = await screen.findByTestId("explorer-link");
    expect(link).toHaveAttribute("href", expect.stringContaining("abc123"));
    expect(screen.getByText(/liquidation submitted/i)).toBeInTheDocument();
  });

  it("renders a localised error message when executeLiquidation rejects", async () => {
    mocks.executeLiquidation.mockRejectedValue(new Error("HostError: position healthy"));
    await setupAndSubmit();

    expect(
      await screen.findByText(/liquidation failed/i),
    ).toBeInTheDocument();
    // decodeContractError should produce a user-readable message
    expect(await screen.findByRole("alert")).toBeTruthy();
  });
});

// ----- Lookup error -----

describe("lookup error", () => {
  it("shows a localised error when getBorrowerPosition rejects", async () => {
    mocks.getBorrowerPosition.mockRejectedValue(new Error("RPC timeout"));
    renderPanel();

    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: VALID_BORROWER } });
    fireEvent.click(screen.getByRole("button", { name: /look up/i }));

    expect(
      await screen.findByText(/could not load position/i),
    ).toBeInTheDocument();
  });
});
