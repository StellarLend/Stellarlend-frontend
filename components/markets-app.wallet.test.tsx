import React from "react";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextIntlClientProvider } from "next-intl";
import MarketsApp from "./markets-app";
import * as walletModule from "./wallet";
import { getAssetKey } from "@/lib/horizon";
import { TESTNET_ISSUERS } from "@/lib/config";
import messages from "@/messages/en.json";

vi.mock("./wallet", async () => {
  const actual = await vi.importActual<typeof walletModule>("./wallet");
  return {
    ...actual,
    useWallet: vi.fn(),
  };
});

const WALLET = "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7";

const NATIVE_BALANCE = {
  assetType: "native",
  code: "XLM",
  balance: "150.0000000",
  available: "148.0000000",
  buyingLiabilities: "0",
  sellingLiabilities: "0",
};

describe("MarketsApp Wallet balance column", () => {
  const mockAddTrustline = vi.fn().mockResolvedValue({ hash: "txhash123" });

  beforeEach(() => {
    vi.clearAllMocks();
    // jsdom lacks matchMedia; openTrade reads it to decide whether to scroll the inline panel.
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })) as unknown as typeof window.matchMedia;
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
    } as unknown as ReturnType<typeof walletModule.useWallet>);

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
    } as unknown as ReturnType<typeof walletModule.useWallet>);

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
    } as unknown as ReturnType<typeof walletModule.useWallet>);

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
    } as unknown as ReturnType<typeof walletModule.useWallet>);

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

  it("detects the missing trustline in the trade panel and blocks supply", async () => {
    vi.mocked(walletModule.useWallet).mockReturnValue({
      address: WALLET,
      balance: "150.00",
      balances: { native: NATIVE_BALANCE },
      isUnfunded: false,
      error: null,
      connect: vi.fn(),
      disconnect: vi.fn(),
      refreshBalances: vi.fn(),
      addTrustline: mockAddTrustline,
    } as unknown as ReturnType<typeof walletModule.useWallet>);

    renderMarketsApp();

    fireEvent.click(screen.getAllByRole("button", { name: "Trade USDC" })[0]);

    const notices = await screen.findAllByTestId("trustline-notice-USDC");
    expect(within(notices[0]).getByRole("button", { name: "Add trustline" })).toBeInTheDocument();
    for (const confirm of screen.getAllByRole("button", { name: "Confirm Supply" })) {
      expect(confirm).toBeDisabled();
    }
  });

  it("enables the form after the trustline is added successfully", async () => {
    const usdcKey = getAssetKey({ code: "USDC", issuer: TESTNET_ISSUERS.USDC });
    const balances: Record<string, unknown> = { native: NATIVE_BALANCE };
    const addTrustline = vi.fn(async () => {
      // Simulate the wallet refreshing balances after the changeTrust transaction.
      balances[usdcKey] = {
        assetType: "credit_alphanum4",
        code: "USDC",
        balance: "0.0000000",
        available: "0.0000000",
        buyingLiabilities: "0",
        sellingLiabilities: "0",
      };
      return { hash: "txhash123" };
    });

    vi.mocked(walletModule.useWallet).mockReturnValue({
      address: WALLET,
      balance: "150.00",
      balances,
      isUnfunded: false,
      error: null,
      connect: vi.fn(),
      disconnect: vi.fn(),
      refreshBalances: vi.fn(),
      addTrustline,
    } as unknown as ReturnType<typeof walletModule.useWallet>);

    renderMarketsApp();

    fireEvent.click(screen.getAllByRole("button", { name: "Trade USDC" })[0]);

    const notice = (await screen.findAllByTestId("trustline-notice-USDC"))[0];
    fireEvent.click(within(notice).getByRole("button", { name: "Add trustline" }));

    expect(addTrustline).toHaveBeenCalledWith({ code: "USDC", issuer: TESTNET_ISSUERS.USDC });

    await waitFor(() => {
      expect(screen.queryAllByTestId("trustline-notice-USDC")).toHaveLength(0);
    });
    for (const confirm of screen.getAllByRole("button", { name: "Confirm Supply" })) {
      expect(confirm).not.toBeDisabled();
    }
  });
});
