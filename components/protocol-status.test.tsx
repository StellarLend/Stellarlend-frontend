import React from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextIntlClientProvider } from "next-intl";
import messages from "@/messages/en.json";
import { ProtocolStatusBanner, ProtocolStatusProvider } from "./protocol-status";
import * as ProtocolStatusModule from "@/lib/protocol-status";

vi.mock("@/lib/protocol-status", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/protocol-status")>();
  return {
    ...actual,
    getProtocolStatus: vi.fn(),
  };
});

function renderWithStatus(status: ProtocolStatusModule.ProtocolStatus | null) {
  vi.mocked(ProtocolStatusModule.getProtocolStatus).mockResolvedValue(
    status ?? { kind: "ok", emergency: "Normal", paused: { All: false, Supply: false, Borrow: false, Withdraw: false, Repay: false, Liquidate: false }, ledger: 0 }
  );

  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <ProtocolStatusProvider>
        <ProtocolStatusBanner />
      </ProtocolStatusProvider>
    </NextIntlClientProvider>
  );
}

describe("ProtocolStatusBanner", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders nothing when status is null / initial load before resolution", () => {
    // Return a promise that does not resolve immediately
    vi.mocked(ProtocolStatusModule.getProtocolStatus).mockReturnValue(new Promise(() => {}));

    const { container } = render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <ProtocolStatusProvider>
          <ProtocolStatusBanner />
        </ProtocolStatusProvider>
      </NextIntlClientProvider>
    );
    expect(container.querySelector('[role="alert"]')).toBeNull();
    expect(container.querySelector('[role="status"]')).toBeNull();
  });

  it("renders neutral indicator when status is unknown (RPC failure)", async () => {
    renderWithStatus({ kind: "unknown", error: "RPC network timeout" });

    expect(
      await screen.findByText("Protocol status unknown (RPC unreachable). Actions remain enabled.")
    ).toBeTruthy();
    expect(screen.getByRole("status")).toBeTruthy();
  });

  it("renders banner for Paused-All", async () => {
    renderWithStatus({
      kind: "ok",
      emergency: "Normal",
      paused: {
        All: true,
        Supply: false,
        Borrow: false,
        Withdraw: false,
        Repay: false,
        Liquidate: false,
      },
      ledger: 12345,
    });

    expect(
      await screen.findByText("The protocol is currently paused. All operations are disabled.")
    ).toBeTruthy();
    expect(screen.getByRole("alert")).toBeTruthy();
  });

  it("renders banner for Paused-Borrow-only", async () => {
    renderWithStatus({
      kind: "ok",
      emergency: "Normal",
      paused: {
        All: false,
        Supply: false,
        Borrow: true,
        Withdraw: false,
        Repay: false,
        Liquidate: false,
      },
      ledger: 12345,
    });

    expect(await screen.findByText("Protocol operation(s) paused: Borrow.")).toBeTruthy();
    expect(screen.getByRole("alert")).toBeTruthy();
  });

  it("renders banner for Shutdown", async () => {
    renderWithStatus({
      kind: "ok",
      emergency: "Shutdown",
      paused: {
        All: false,
        Supply: false,
        Borrow: false,
        Withdraw: false,
        Repay: false,
        Liquidate: false,
      },
      ledger: 12345,
    });

    expect(
      await screen.findByText("Protocol is shut down. All operations are currently disabled.")
    ).toBeTruthy();
    expect(screen.getByRole("alert")).toBeTruthy();
  });

  it("renders banner for Recovery", async () => {
    renderWithStatus({
      kind: "ok",
      emergency: "Recovery",
      paused: {
        All: false,
        Supply: false,
        Borrow: false,
        Withdraw: false,
        Repay: false,
        Liquidate: false,
      },
      ledger: 12345,
    });

    expect(
      await screen.findByText(
        "Protocol is in recovery mode. Only withdrawals, repayments, and liquidations are allowed."
      )
    ).toBeTruthy();
    expect(screen.getByRole("alert")).toBeTruthy();
  });

  it("renders nothing when status is Normal and no operations are paused", async () => {
    const { container } = renderWithStatus({
      kind: "ok",
      emergency: "Normal",
      paused: {
        All: false,
        Supply: false,
        Borrow: false,
        Withdraw: false,
        Repay: false,
        Liquidate: false,
      },
      ledger: 12345,
    });

    // Wait a tick for effects
    await new Promise((r) => setTimeout(r, 50));
    expect(container.querySelector('[role="alert"]')).toBeNull();
    expect(container.querySelector('[role="status"]')).toBeNull();
  });
});
