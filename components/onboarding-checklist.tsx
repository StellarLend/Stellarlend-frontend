import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { OnboardingChecklist } from "./onboarding-checklist";
import { useWallet } from "./wallet";
import { config } from "@/lib/config";

vi.mock("./wallet", () => ({
  useWallet: vi.fn(),
}));

vi.mock("@stellar/freighter-api", () => ({
  isConnected: vi.fn().mockResolvedValue({ isConnected: true }),
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => {
    const messages: Record<string, string> = {
      title: "Testnet Quickstart Checklist",
      subtitle: "Complete these steps to start using StellarLend on testnet in under a minute.",
      dismiss: "Dismiss",
      stepInstalled: "Freighter wallet installed",
      installFreighter: "Install Freighter",
      stepConnected: "Wallet connected",
      stepNetwork: "Connected to Stellar Testnet",
      stepFunded: "Account funded with testnet XLM",
      stepSupply: "First supply position created",
      fundWithFriendbot: "Fund with Friendbot",
      funding: "Funding account...",
      manualLink: "Stellar Lab Faucet",
      retry: "Retry",
      manualFaucet: "Manual Faucet",
    };
    return messages[key] || key;
  },
}));

describe("OnboardingChecklist", () => {
  const mockFundAccount = vi.fn();

  beforeEach(() => {
    vi.restoreAllMocks();
    config.network = "testnet";
    localStorage.clear();

    vi.mocked(useWallet).mockReturnValue({
      address: null,
      balance: null,
      error: null,
      accountStatus: "unknown",
      isFunding: false,
      fundError: null,
      connect: vi.fn(),
      disconnect: vi.fn(),
      fundAccount: mockFundAccount,
      refreshBalance: vi.fn(),
    });
  });

  it("renders checklist on testnet when not dismissed", () => {
    render(<OnboardingChecklist hasSupplied={false} />);
    expect(screen.getByTestId("onboarding-checklist")).toBeInTheDocument();
    expect(screen.getByText("Testnet Quickstart Checklist")).toBeInTheDocument();
  });

  it("does not render when network is not testnet", () => {
    config.network = "mainnet";
    const { container } = render(<OnboardingChecklist hasSupplied={false} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders fund button when connected and account is unfunded", () => {
    vi.mocked(useWallet).mockReturnValue({
      address: "GCXKG6RN4ONIEPCMNFB732A436Z5PNDSRLGWK7GBLCMQLIFO4HXQIUX4",
      balance: "0.00 (unfunded on testnet)",
      error: null,
      accountStatus: "unfunded",
      isFunding: false,
      fundError: null,
      connect: vi.fn(),
      disconnect: vi.fn(),
      fundAccount: mockFundAccount,
      refreshBalance: vi.fn(),
    });

    render(<OnboardingChecklist hasSupplied={false} />);
    const fundBtn = screen.getByRole("button", { name: "Fund with Friendbot" });
    expect(fundBtn).toBeInTheDocument();

    fireEvent.click(fundBtn);
    expect(mockFundAccount).toHaveBeenCalledTimes(1);
  });

  it("displays error with retry button when fundError is present", () => {
    vi.mocked(useWallet).mockReturnValue({
      address: "GCXKG6RN4ONIEPCMNFB732A436Z5PNDSRLGWK7GBLCMQLIFO4HXQIUX4",
      balance: null,
      error: null,
      accountStatus: "error",
      isFunding: false,
      fundError: "Failed to connect to Friendbot.",
      connect: vi.fn(),
      disconnect: vi.fn(),
      fundAccount: mockFundAccount,
      refreshBalance: vi.fn(),
    });

    render(<OnboardingChecklist hasSupplied={false} />);
    expect(screen.getByText("Failed to connect to Friendbot.")).toBeInTheDocument();
    const retryBtn = screen.getByRole("button", { name: "Retry" });
    expect(retryBtn).toBeInTheDocument();
    fireEvent.click(retryBtn);
    expect(mockFundAccount).toHaveBeenCalledTimes(1);
  });

  it("can be dismissed permanently via localStorage", () => {
    const { rerender } = render(<OnboardingChecklist hasSupplied={false} />);
    const dismissBtn = screen.getByRole("button", { name: /Dismiss/i });
    fireEvent.click(dismissBtn);

    expect(localStorage.getItem("stellarlend_onboarding_dismissed")).toBe("true");

    rerender(<OnboardingChecklist hasSupplied={false} />);
    expect(screen.queryByTestId("onboarding-checklist")).not.toBeInTheDocument();
  });

  it("shows first supply done when hasSupplied is true", () => {
    render(<OnboardingChecklist hasSupplied={true} />);
    const supplyStep = screen.getByText("First supply position created");
    expect(supplyStep).toHaveClass("line-through");
  });
});
