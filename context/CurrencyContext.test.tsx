import { render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { CurrencyProvider, useCurrencyPreference } from "./CurrencyContext";

const TestComponent = () => {
  const { currency, isLoading, error } = useCurrencyPreference();
  if (isLoading) return <div data-testid="loading">Loading...</div>;
  if (error) return <div data-testid="error">{error.message}</div>;
  return <div data-testid="currency">{currency}</div>;
};

describe("CurrencyContext", () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it("fetches and provides the displayCurrency preference", async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ displayCurrency: "EUR" }),
    });

    render(
      <CurrencyProvider>
        <TestComponent />
      </CurrencyProvider>
    );

    expect(screen.getByTestId("loading")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByTestId("currency")).toHaveTextContent("EUR");
    });
  });

  it("picks up a non-USD displayCurrency from the preferences endpoint", async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ displayCurrency: "BTC" }),
    });

    render(
      <CurrencyProvider>
        <TestComponent />
      </CurrencyProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("currency")).toHaveTextContent("BTC");
    });
  });

  it("falls back to USD if preference is unset", async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    });

    render(
      <CurrencyProvider>
        <TestComponent />
      </CurrencyProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("currency")).toHaveTextContent("USD");
    });
  });

  it("falls back to USD on invalid preference or fetch error", async () => {
    global.fetch.mockRejectedValueOnce(new Error("Network error"));

    render(
      <CurrencyProvider>
        <TestComponent />
      </CurrencyProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("error")).toHaveTextContent("Network error");
    });
  });
});