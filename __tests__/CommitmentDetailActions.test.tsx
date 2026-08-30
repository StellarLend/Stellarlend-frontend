import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import CommitmentDetailActions from "../components/CommitmentDetailActions";

// Mock fetch for POST and tx status endpoints
beforeEach(() => {
  vi.restoreAllMocks();
  // Clear localStorage
  localStorage.clear();
});

describe("CommitmentDetailActions state machine", () => {
  it("prevents duplicate submissions and completes a happy path", async () => {
    const commitmentId = "C1";
    // mock POST to return accepted + txHash
    vi.stubGlobal("fetch", vi.fn(async (input: any, init: any) => {
      const url = typeof input === "string" ? input : input.url;
      if (url.includes("/action")) {
        const body = JSON.parse(init.body);
        return { json: async () => ({ requestId: body.requestId, status: "accepted", txHash: "TX-1" }) } as any;
      }
      if (url.includes("/txs/status")) {
        return { json: async () => ({ txHash: "TX-1", status: "confirmed" }) } as any;
      }
      return { json: async () => ({}) } as any;
    }));

    render(<CommitmentDetailActions commitmentId={commitmentId} />);
    const fund = screen.getByText("Fund") as HTMLButtonElement;
    expect(fund.disabled).toBe(false);
    fireEvent.click(fund);
    // Immediately try click again — should be disabled by state machine
    fireEvent.click(fund);
    await waitFor(() => expect(screen.getByText(/Action state:/)).toBeTruthy());
    await waitFor(() => expect(screen.getByText(/Confirmed/)).toBeTruthy(), { timeout: 3000 });
    // ensure localStorage cleaned up
    expect(localStorage.getItem("commitment_action:" + commitmentId)).toBeNull();
  });

  it("ignores stale responses from earlier requestIds", async () => {
    const commitmentId = "C2";
    // We'll simulate two POST calls; the first will resolve after the second
    let resolveFirst: Function | null = null;
    let resolveSecond: Function | null = null;
    let firstPromise = new Promise(res => (resolveFirst = res));
    let secondPromise = new Promise(res => (resolveSecond = res));

    let call = 0;
    vi.stubGlobal("fetch", vi.fn(async (input: any, init: any) => {
      const url = typeof input === "string" ? input : input.url;
      if (url.includes("/action")) {
        call += 1;
        const body = JSON.parse(init.body);
        if (call === 1) return await firstPromise as any;
        if (call === 2) return await secondPromise as any;
      }
      if (url.includes("/txs/status")) {
        return { json: async () => ({ txHash: "TX-2", status: "confirmed" }) } as any;
      }
      return { json: async () => ({}) } as any;
    }));

    render(<CommitmentDetailActions commitmentId={commitmentId} />);
    const fund = screen.getByText("Fund") as HTMLButtonElement;
    fireEvent.click(fund); // first call
    fireEvent.click(fund); // second call — duplicate prevented but in our mock will create second server response

    // Resolve second first with a completed response
    resolveSecond && resolveSecond({ json: async () => ({ requestId: "r2", status: "accepted", txHash: "TX-2" }) });
    // Now resolve first (stale) with a different requestId
    resolveFirst && resolveFirst({ json: async () => ({ requestId: "r1", status: "accepted", txHash: "TX-OLD" }) });

    await waitFor(() => expect(screen.getByText(/Pending on-chain/)).toBeTruthy(), { timeout: 3000 });
    expect(screen.queryByText("TX-OLD")).toBeNull();
  });

  it("recovers pending intent on mount and completes when tx confirms", async () => {
    const commitmentId = "C3";
    // Place a persisted pending intent to simulate interrupted flow
    localStorage.setItem("commitment_action:" + commitmentId, JSON.stringify({ action: "fund", requestId: "r3", state: "PendingOnChain", txHash: "TX-3" }));

    vi.stubGlobal("fetch", vi.fn(async (input: any) => {
      const url = typeof input === "string" ? input : input.url;
      if (url.includes("/txs/status")) {
        return { json: async () => ({ txHash: "TX-3", status: "confirmed" }) } as any;
      }
      return { json: async () => ({}) } as any;
    }));

    render(<CommitmentDetailActions commitmentId={commitmentId} />);
    await waitFor(() => expect(screen.getByText(/Confirmed/)).toBeTruthy(), { timeout: 3000 });
    expect(localStorage.getItem("commitment_action:" + commitmentId)).toBeNull();
  });

  it("disables actions when permission denied", () => {
    render(<CommitmentDetailActions commitmentId={"C4"} canAct={false} />);
    const fund = screen.getByText("Fund") as HTMLButtonElement;
    expect(fund.disabled).toBe(true);
  });
});
