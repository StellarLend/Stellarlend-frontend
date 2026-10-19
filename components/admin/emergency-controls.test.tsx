import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { EmergencyControls } from "./emergency-controls";
import * as adminLib from "@/lib/admin";

// Mock next-intl
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, values?: any) => {
    if (values) {
      let str = key;
      for (const [k, v] of Object.entries(values)) {
        str += ` ${k}=${v}`;
      }
      return str;
    }
    return key;
  },
}));

// Mock useWallet
let mockAddress: string | null = null;
vi.mock("@/components/wallet", () => ({
  useWallet: () => ({
    address: mockAddress,
    connected: Boolean(mockAddress),
  }),
}));

describe("EmergencyControls component", () => {
  const ADMIN_ADDR = "GADMIN1111111111111111111111111111111111111111111111111111";
  const GUARDIAN_ADDR = "GGUARDIAN1111111111111111111111111111111111111111111111111";
  const STRANGER_ADDR = "GSTRANGER1111111111111111111111111111111111111111111111111";

  beforeEach(() => {
    vi.spyOn(adminLib, "getAdmin").mockResolvedValue(ADMIN_ADDR);
    vi.spyOn(adminLib, "getGuardian").mockResolvedValue(GUARDIAN_ADDR);
    vi.spyOn(adminLib, "getContractEmergencyData").mockResolvedValue({
      emergencyState: "Normal",
      pauseStates: {
        All: { paused: false },
        Deposit: { paused: false },
        Withdraw: { paused: false },
        Borrow: { paused: false },
        Repay: { paused: false },
        Liquidation: { paused: false },
        FlashLoan: { paused: false },
      },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    mockAddress = null;
  });

  it("renders 403 Access Denied view when non-privileged address is connected", async () => {
    render(
      <EmergencyControls
        initialAdmin={ADMIN_ADDR}
        initialGuardian={GUARDIAN_ADDR}
        connectedAddress={STRANGER_ADDR}
        customRpcServer={
          {
            getLatestLedger: vi.fn().mockResolvedValue({ sequence: 1000 }),
          } as any
        }
      />
    );

    await waitFor(() => {
      expect(screen.getByText("accessDeniedTitle")).toBeInTheDocument();
      expect(screen.getByText("accessDeniedSubtitle")).toBeInTheDocument();
    });

    // Main admin forms should NOT be rendered
    expect(screen.queryByText("pauseControlsTitle")).not.toBeInTheDocument();
    expect(screen.queryByText("emergencyStateTitle")).not.toBeInTheDocument();
  });

  it("renders guardian controls with only Shutdown available for emergency transition", async () => {
    render(
      <EmergencyControls
        initialAdmin={ADMIN_ADDR}
        initialGuardian={GUARDIAN_ADDR}
        connectedAddress={GUARDIAN_ADDR}
        customRpcServer={
          {
            getLatestLedger: vi.fn().mockResolvedValue({ sequence: 1000 }),
          } as any
        }
      />
    );

    await waitFor(() => {
      expect(screen.getByText("guardianRole")).toBeInTheDocument();
      expect(screen.getByText("pauseControlsTitle")).toBeInTheDocument();
      expect(screen.getByText("emergencyStateTitle")).toBeInTheDocument();
    });

    // Guardian note must be visible
    expect(screen.getByText("guardianRestrictionNote")).toBeInTheDocument();

    // Check emergency state select options
    const stateSelect = screen.getByLabelText("selectState");
    expect(stateSelect).toBeInTheDocument();

    const options = Array.from((stateSelect as HTMLSelectElement).options).map(
      (opt) => opt.value
    );
    expect(options).toEqual(["Shutdown"]);
  });

  it("renders admin controls with Normal, Shutdown, and Recovery available", async () => {
    render(
      <EmergencyControls
        initialAdmin={ADMIN_ADDR}
        initialGuardian={GUARDIAN_ADDR}
        connectedAddress={ADMIN_ADDR}
        customRpcServer={
          {
            getLatestLedger: vi.fn().mockResolvedValue({ sequence: 1000 }),
          } as any
        }
      />
    );

    await waitFor(() => {
      expect(screen.getByText("adminRole")).toBeInTheDocument();
      expect(screen.getByText("pauseControlsTitle")).toBeInTheDocument();
      expect(screen.getByText("emergencyStateTitle")).toBeInTheDocument();
    });

    // Guardian note should NOT be present for admin
    expect(screen.queryByText("guardianRestrictionNote")).not.toBeInTheDocument();

    // Check emergency state select options for admin
    const stateSelect = screen.getByLabelText("selectState");
    const options = Array.from((stateSelect as HTMLSelectElement).options).map(
      (opt) => opt.value
    );
    expect(options).toEqual(["Normal", "Shutdown", "Recovery"]);
  });

  it("calculates and displays TTL ledgers and estimated expiry", async () => {
    render(
      <EmergencyControls
        initialAdmin={ADMIN_ADDR}
        initialGuardian={GUARDIAN_ADDR}
        connectedAddress={ADMIN_ADDR}
        customRpcServer={
          {
            getLatestLedger: vi.fn().mockResolvedValue({ sequence: 2000 }),
          } as any
        }
      />
    );

    await waitFor(() => {
      expect(screen.getByText("adminRole")).toBeInTheDocument();
    });

    // 1 hour at 5s/ledger = 720 ledgers; expires at 2000 + 720 = 2720
    const ttlInput = screen.getByLabelText(/ttlHoursLabel/i);
    fireEvent.change(ttlInput, { target: { value: "2" } });

    // 2 hours at 5s/ledger = 1440 ledgers; expires at 2000 + 1440 = 3440
    await waitFor(() => {
      expect(screen.getByText(/ttlCalculatedLedgers ledgers=1,440/)).toBeInTheDocument();
      expect(screen.getByText(/ttlCalculatedExpiry ledger=3,440/)).toBeInTheDocument();
    });
  });
});
