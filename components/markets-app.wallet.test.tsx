import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextIntlClientProvider } from "next-intl";
import MarketsApp from "./markets-app";
import * as walletModule from "./wallet";
import messages from "@/messages/en.json";

vi.mock("./wallet", async () => {
  const actual = await vi.importActual<typeof walletModule>("./wallet");
  return {
    ...actual,
    useWallet: vi.fn(),
  };
});

describe("MarketsApp Wallet balance column", () => {
  const mockAddTrustline = vi.fn().mockResolvedValue({ hash: "txhash123" });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  function renderMarketsApp() {
    return render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <MarketsApp />
      </NextIntlClientProvider>
    );
  }

  it("renders '-' for all assets when wallet is disconnected", () => {
    vi.mocked(walletModule.useWallet).mockReturnValue({
      address: null,
      balance: null,
      balances: {},
      isUnfunded: false,
      error: null,
      connect: vi.fn(),
      disconnect: vi.fn(),
      refreshBalances: vi.fn(),
      addTrustline: mockAddTrustline,
    });

    renderMarketsApp();

    const xlmCell = screen.getByTestId("wallet-balance-XLM");
    const usdcCell = screen.getByTestId("wallet-balance-USDC");
    expect(xlmCell).toHaveTextContent("-");
    expect(usdcCell).toHaveTextContent("-");
  });

  it("renders unfunded indicator when account is unfunded on testnet", () => {
    vi.mocked(walletModule.useWallet).mockReturnValue({
      address: "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7",
      balance: "0.00 (unfunded on testnet)",
      balances: {},
      isUnfunded: true,
      error: null,
      connect: vi.fn(),
      disconnect: vi.fn(),
      refreshBalances: vi.fn(),
      addTrustline: mockAddTrustline,
    });

    renderMarketsApp();

    const xlmCell = screen.getByTestId("wallet-balance-XLM");
    expect(xlmCell).toHaveTextContent("unfunded");
  });

  it("renders available balance when account holds asset trustline", () => {
    vi.mocked(walletModule.useWallet).mockReturnValue({
      address: "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7",
      balance: "150.00",
      balances: {
        native: {
          assetType: "native",
          code: "XLM",
          balance: "150.0000000",
          available: "148.0000000",
          buyingLiabilities: "0",
          sellingLiabilities: "0",
        },
        USDC: {
          assetType: "credit_alphanum4",
          code: "USDC",
          balance: "250.0000000",
          available: "250.0000000",
          buyingLiabilities: "0",
          sellingLiabilities: "0",
        },
      },
      isUnfunded: false,
      error: null,
      connect: vi.fn(),
      disconnect: vi.fn(),
      refreshBalances: vi.fn(),
      addTrustline: mockAddTrustline,
    });

    renderMarketsApp();

    const xlmCell = screen.getByTestId("wallet-balance-XLM");
    const usdcCell = screen.getByTestId("wallet-balance-USDC");
    expect(xlmCell).toHaveTextContent("148 XLM");
    expect(usdcCell).toHaveTextContent("250 USDC");
  });

  it("renders 'Add trustline' button when trustline is missing and triggers transaction on click", async () => {
    vi.mocked(walletModule.useWallet).mockReturnValue({
      address: "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7",
      balance: "150.00",
      balances: {
        native: {
          assetType: "native",
          code: "XLM",
          balance: "150.0000000",
          available: "148.0000000",
          buyingLiabilities: "0",
          sellingLiabilities: "0",
        },
      },
      isUnfunded: false,
      error: null,
      connect: vi.fn(),
      disconnect: vi.fn(),
      refreshBalances: vi.fn(),
      addTrustline: mockAddTrustline,
    });

    renderMarketsApp();

    const usdcCell = screen.getByTestId("wallet-balance-USDC");
    const btn = usdcCell.querySelector("button");
    expect(btn).toBeInTheDocument();
    expect(btn).toHaveTextContent("Add trustline");

    fireEvent.click(btn!);
    expect(mockAddTrustline).toHaveBeenCalledWith({
      code: "USDC",
      issuer: expect.any(String),
    });
  });
});
