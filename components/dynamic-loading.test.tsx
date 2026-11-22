import React from "react";
import { render, screen, act, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextIntlClientProvider } from "next-intl";
import enMessages from "@/messages/en.json";

let resolveRateChart: ((mod: { default: React.ComponentType }) => void) | null = null;
let resolveWalletPicker: ((mod: { default: React.ComponentType }) => void) | null = null;

vi.mock("next/dynamic", () => ({
  default: (
    loader: () => Promise<unknown>,
    options?: { loading?: () => React.ReactNode; ssr?: boolean }
  ) => {
    const loaderSource = loader.toString();
    const isRateChart = loaderSource.includes("rate-chart");
    const isWalletPicker = loaderSource.includes("wallet-picker");

    return function DynamicMock(props: Record<string, unknown>) {
      const [Comp, setComp] = React.useState<React.ComponentType<Record<string, unknown>> | null>(
        null
      );

      React.useEffect(() => {
        let active = true;
        const promise = new Promise<{ default: React.ComponentType<Record<string, unknown>> }>(
          (resolve) => {
            if (isRateChart) {
              resolveRateChart = resolve as (mod: { default: React.ComponentType }) => void;
            } else if (isWalletPicker) {
              resolveWalletPicker = resolve as (mod: { default: React.ComponentType }) => void;
            } else {
              resolve({ default: () => <div data-testid="dynamic-resolved" /> });
            }
          }
        );

        promise.then((mod) => {
          if (active) setComp(() => mod.default);
        });

        return () => {
          active = false;
        };
      }, []);

      if (!Comp) {
        return options?.loading ? <>{options.loading()}</> : null;
      }
      return <Comp {...props} />;
    };
  },
}));

import MarketsApp from "./markets-app";
import { WalletProvider, ConnectButton } from "./wallet";

describe("Dynamic loading skeletons", () => {
  beforeEach(() => {
    resolveRateChart = null;
    resolveWalletPicker = null;
  });

  it("shows localized aria-busy skeleton before RateChart resolves and renders chart after", async () => {
    render(
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <MarketsApp />
      </NextIntlClientProvider>
    );

    const skeleton = screen.getByTestId("rate-chart-skeleton");
    expect(skeleton).toBeInTheDocument();
    expect(skeleton).toHaveAttribute("aria-busy", "true");
    expect(skeleton).toHaveAttribute(
      "aria-label",
      enMessages.market.rateModel.loadingChart
    );

    await act(async () => {
      resolveRateChart?.({
        default: () => <div data-testid="resolved-rate-chart">Loaded Rate Chart</div>,
      });
    });

    await waitFor(() => {
      expect(screen.getByTestId("resolved-rate-chart")).toBeInTheDocument();
    });
    expect(screen.queryByTestId("rate-chart-skeleton")).not.toBeInTheDocument();
  });

  it("shows localized aria-busy skeleton for WalletPickerModal when opened before it resolves", async () => {
    render(
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <WalletProvider>
          <ConnectButton />
        </WalletProvider>
      </NextIntlClientProvider>
    );

    // Picker is not mounted until opened
    expect(screen.queryByTestId("wallet-picker-skeleton")).not.toBeInTheDocument();

    const connectBtn = screen.getByRole("button");
    fireEvent.mouseEnter(connectBtn);
    fireEvent.focus(connectBtn);
    fireEvent.click(connectBtn);

    const skeleton = screen.getByTestId("wallet-picker-skeleton");
    expect(skeleton).toBeInTheDocument();
    expect(skeleton).toHaveAttribute("aria-busy", "true");
    expect(skeleton).toHaveAttribute("aria-label", enMessages.wallet.loadingWallets);

    await act(async () => {
      resolveWalletPicker?.({
        default: () => <div data-testid="resolved-wallet-picker">Loaded Wallet Picker</div>,
      });
    });

    await waitFor(() => {
      expect(screen.getByTestId("resolved-wallet-picker")).toBeInTheDocument();
    });
    expect(screen.queryByTestId("wallet-picker-skeleton")).not.toBeInTheDocument();
  });
});
