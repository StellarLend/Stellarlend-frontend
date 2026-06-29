import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import LiquidationsPanel, {
  getDistanceToLiquidationPercent,
} from "./LiquidationsPanel";
import type { LiquidationPosition } from "@/lib/positions/liquidation";

const position = (
  overrides: Partial<LiquidationPosition>,
): LiquidationPosition => ({
  asset: "XLM",
  borrowedAmount: 100,
  collateralAsset: "XLM",
  collateralAmount: 200,
  collateralFactor: 0.8,
  healthFactor: 1.6,
  liquidationPriceFactor: 0.63,
  riskScore: 0.4,
  ...overrides,
});

const jsonResponse = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const savedPreferences = (liquidationAlerts: string[] = []) => ({
  userId: "wallet-1",
  locale: "en-US",
  displayCurrency: "USD",
  notifications: {
    emailNotifications: true,
    pushNotifications: true,
    loanAlerts: true,
    marketingEmails: false,
    liquidationAlerts,
  },
});

describe("LiquidationsPanel", () => {
  it("renders liquidation price and distance columns from API outputs", () => {
    render(
      <LiquidationsPanel
        initialPositions={[
          position({
            asset: "USDC",
            borrowedAmount: 250,
            collateralAsset: "XLM",
            collateralAmount: 500,
            healthFactor: 1.25,
            liquidationPriceFactor: 0.5,
          }),
        ]}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Liquidation Risk" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("columnheader", { name: "Liquidation price" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("columnheader", { name: "Distance" }),
    ).toBeInTheDocument();
    expect(screen.getByText("0.50x")).toBeInTheDocument();
    expect(screen.getByText("25.0%")).toBeInTheDocument();
  });

  it("sorts by distance ascending while preserving stable order for ties", () => {
    render(
      <LiquidationsPanel
        initialPositions={[
          position({
            asset: "XLM",
            healthFactor: 1.2,
            liquidationPriceFactor: 0.7,
          }),
          position({
            asset: "USDC",
            healthFactor: 0.95,
            liquidationPriceFactor: 1.05,
          }),
          position({
            asset: "ETH",
            healthFactor: 1.2,
            liquidationPriceFactor: 0.7,
          }),
          position({
            asset: "BTC",
            healthFactor: Number.POSITIVE_INFINITY,
            liquidationPriceFactor: 0,
          }),
        ]}
      />,
    );

    const rows = screen.getAllByRole("row").slice(1);

    expect(within(rows[0]).getByText("100 USDC")).toBeInTheDocument();
    expect(within(rows[1]).getByText("100 XLM")).toBeInTheDocument();
    expect(within(rows[2]).getByText("100 ETH")).toBeInTheDocument();
    expect(within(rows[3]).getByText("100 BTC")).toBeInTheDocument();
  });

  it("shows color-safe text labels for near and past liquidation rows", () => {
    render(
      <LiquidationsPanel
        initialPositions={[
          position({
            asset: "USDC",
            healthFactor: 0.9,
            liquidationPriceFactor: 1.11,
          }),
          position({
            asset: "XLM",
            healthFactor: 1.08,
            liquidationPriceFactor: 0.93,
          }),
          position({
            asset: "ETH",
            healthFactor: 1.2,
            liquidationPriceFactor: 0.83,
          }),
        ]}
      />,
    );

    expect(screen.getByText("Past liquidation")).toBeInTheDocument();
    expect(screen.getByText("Critical")).toBeInTheDocument();
    expect(screen.getByText("Warning")).toBeInTheDocument();
  });

  it("places missing price and distance data after measurable positions", () => {
    render(
      <LiquidationsPanel
        initialPositions={[
          position({
            asset: "BTC",
            healthFactor: Number.POSITIVE_INFINITY,
            liquidationPriceFactor: 0,
          }),
          position({
            asset: "XLM",
            healthFactor: 1.1,
            liquidationPriceFactor: 0.91,
          }),
        ]}
      />,
    );

    const rows = screen.getAllByRole("row").slice(1);

    expect(within(rows[0]).getByText("100 XLM")).toBeInTheDocument();
    expect(within(rows[1]).getByText("100 BTC")).toBeInTheDocument();
    expect(within(rows[1]).getAllByText("N/A")).toHaveLength(2);
    expect(within(rows[1]).getAllByText("Unavailable")).toHaveLength(2);
  });

  it("returns null distance for positions without a finite health factor", () => {
    expect(
      getDistanceToLiquidationPercent({
        healthFactor: Number.POSITIVE_INFINITY,
      }),
    ).toBeNull();
  });

  it("loads current liquidation alert subscriptions from preferences", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(savedPreferences(["liquidation:USDC:XLM"])),
      );

    render(
      <LiquidationsPanel
        initialPositions={[
          position({
            asset: "USDC",
            collateralAsset: "XLM",
            healthFactor: 1.08,
          }),
        ]}
        walletAddress="wallet-1"
        fetcher={fetcher}
      />,
    );

    await waitFor(() =>
      expect(
        screen.getByRole("switch", {
          name: /disable liquidation alerts for usdc/i,
        }),
      ).toHaveAttribute("aria-checked", "true"),
    );

    expect(fetcher).toHaveBeenCalledWith(
      "/api/account/notification-preferences?userId=wallet-1",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it("saves liquidation alert toggles through notification preferences", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ error: "not found" }, 404))
      .mockResolvedValueOnce(
        jsonResponse(savedPreferences(["liquidation:XLM:XLM"])),
      );

    render(
      <LiquidationsPanel
        initialPositions={[position({ asset: "XLM", collateralAsset: "XLM" })]}
        walletAddress="wallet-1"
        fetcher={fetcher}
      />,
    );

    const toggle = await screen.findByRole("switch", {
      name: /enable liquidation alerts for xlm/i,
    });

    await waitFor(() => expect(toggle).not.toBeDisabled());
    fireEvent.click(toggle);

    expect(toggle).toHaveAttribute("aria-checked", "true");

    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));

    expect(fetcher).toHaveBeenLastCalledWith(
      "/api/account/notification-preferences",
      expect.objectContaining({
        method: "PUT",
        headers: { "Content-Type": "application/json" },
      }),
    );

    const [, options] = fetcher.mock.calls[1];
    expect(JSON.parse(String(options?.body))).toMatchObject({
      userId: "wallet-1",
      notifications: {
        liquidationAlerts: ["liquidation:XLM:XLM"],
      },
    });
  });

  it("prevents rapid repeated toggles while a save is pending", async () => {
    let resolveSave: (response: Response) => void = () => {};
    const savePromise = new Promise<Response>((resolve) => {
      resolveSave = resolve;
    });
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ error: "not found" }, 404))
      .mockReturnValueOnce(savePromise);

    render(
      <LiquidationsPanel
        initialPositions={[position({ asset: "XLM", collateralAsset: "XLM" })]}
        walletAddress="wallet-1"
        fetcher={fetcher}
      />,
    );

    const toggle = await screen.findByRole("switch", {
      name: /enable liquidation alerts for xlm/i,
    });

    await waitFor(() => expect(toggle).not.toBeDisabled());
    fireEvent.click(toggle);

    await waitFor(() => expect(toggle).toBeDisabled());
    fireEvent.click(toggle);
    expect(fetcher).toHaveBeenCalledTimes(2);

    resolveSave(jsonResponse(savedPreferences(["liquidation:XLM:XLM"])));

    await waitFor(() => expect(toggle).not.toBeDisabled());
  });

  it("rolls back the alert toggle when saving fails", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(savedPreferences(["liquidation:XLM:XLM"])),
      )
      .mockResolvedValueOnce(jsonResponse({ error: "failed" }, 500));

    render(
      <LiquidationsPanel
        initialPositions={[position({ asset: "XLM", collateralAsset: "XLM" })]}
        walletAddress="wallet-1"
        fetcher={fetcher}
      />,
    );

    const toggle = await screen.findByRole("switch", {
      name: /disable liquidation alerts for xlm/i,
    });

    await waitFor(() => expect(toggle).not.toBeDisabled());
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-checked", "false");

    await waitFor(() =>
      expect(
        screen.getByRole("switch", {
          name: /disable liquidation alerts for xlm/i,
        }),
      ).toHaveAttribute("aria-checked", "true"),
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Unable to save liquidation alert preference.",
    );
  });

  it("disables row alert toggles until a wallet address is available", () => {
    render(
      <LiquidationsPanel
        initialPositions={[position({ asset: "XLM", collateralAsset: "XLM" })]}
      />,
    );

    expect(
      screen.getByRole("switch", {
        name: /connect a wallet to manage liquidation alerts for xlm/i,
      }),
    ).toBeDisabled();
  });

  it("does not render alert toggles when no positions exist", () => {
    render(<LiquidationsPanel initialPositions={[]} />);

    expect(screen.queryByRole("switch")).not.toBeInTheDocument();
  });
});
