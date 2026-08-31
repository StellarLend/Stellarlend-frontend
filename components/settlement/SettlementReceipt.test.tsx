import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SettlementReceipt from "./SettlementReceipt";
import { COMMITMENT_BOUNDS } from "../../types/commitment";

// Mock fetch globally
const globalFetch = vi.fn();
global.fetch = globalFetch;

// Mock localStorage
const localStorageMock = (function () {
  let store: Record<string, string> = {};
  return {
    getItem(key: string) {
      return store[key] || null;
    },
    setItem(key: string, value: string) {
      store[key] = value.toString();
    },
    removeItem(key: string) {
      delete store[key];
    },
    clear() {
      store = {};
    },
  };
})();
Object.defineProperty(global, "localStorage", { value: localStorageMock });

describe("SettlementReceipt", () => {
  const mockCommitmentId = "commit-123";
  const mockTelemetry = vi.fn();

  beforeEach(() => {
    globalFetch.mockReset();
    mockTelemetry.mockReset();
    localStorage.clear();
  });

  afterEach(() => {
  });

  it("renders loading state initially and then shows settle button", async () => {
    globalFetch.mockResolvedValueOnce({
      ok: true,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({
        commitment: {
          id: mockCommitmentId,
          status: "active",
          amount: 100,
          asset: "USDC",
          collateralAmount: 200,
          collateralAsset: "XLM",
        },
      }),
    });

    render(
      <SettlementReceipt
        commitmentId={mockCommitmentId}
        onTelemetry={mockTelemetry}
      />
    );

    expect(screen.getByText("Loading settlement data...")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("Settlement Receipt")).toBeInTheDocument();
    });

    expect(screen.getByText("active")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /settle commitment/i })).toBeInTheDocument();
  });

  it("enters submitting state and updates on successful settle", async () => {
    const user = userEvent.setup();
    
    // Initial fetch
    globalFetch.mockResolvedValueOnce({
      ok: true,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({
        commitment: { id: mockCommitmentId, status: "active" },
      }),
    });

    render(<SettlementReceipt commitmentId={mockCommitmentId} onTelemetry={mockTelemetry} />);
    
    await waitFor(() => expect(screen.getByRole("button", { name: /settle commitment/i })).toBeInTheDocument());

    // Mock the POST request for settlement
    globalFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, transactionHash: "hash-123" }),
    });

    await act(async () => {
      await user.click(screen.getByRole("button", { name: /settle commitment/i }));
    });

    await waitFor(() => {
      expect(screen.getByText("Settled")).toBeInTheDocument();
    });

    expect(mockTelemetry).toHaveBeenCalledWith(
      expect.objectContaining({ type: "action_completed", action: "settle", status: "settled" })
    );
  });

  it("enters recovering state if POST request fails or times out", async () => {
    const user = userEvent.setup();
    
    // Initial fetch
    globalFetch.mockResolvedValueOnce({
      ok: true,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({
        commitment: { id: mockCommitmentId, status: "active" },
      }),
    });

    render(<SettlementReceipt commitmentId={mockCommitmentId} onTelemetry={mockTelemetry} />);
    
    await waitFor(() => expect(screen.getByRole("button", { name: /settle commitment/i })).toBeInTheDocument());

    // Mock the POST request failure
    globalFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
    });

    await act(async () => {
      await user.click(screen.getByRole("button", { name: /settle commitment/i }));
    });

    await waitFor(() => {
      expect(screen.getByText(/recovering settlement state/i)).toBeInTheDocument();
    });
    
    // Check localStorage intent is preserved
    expect(localStorage.getItem(`settlement_intent_${mockCommitmentId}`)).toBeTruthy();
  });

  it("recovers on mount if localStorage has intent and status is settled", async () => {
    localStorage.setItem(`settlement_intent_${mockCommitmentId}`, "12345");
    
    // Initial fetch returns settled
    globalFetch.mockResolvedValueOnce({
      ok: true,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({
        commitment: { id: mockCommitmentId, status: "settled" },
      }),
    });

    render(<SettlementReceipt commitmentId={mockCommitmentId} onTelemetry={mockTelemetry} />);

    await waitFor(() => {
      expect(screen.getByText("Settled")).toBeInTheDocument();
    });

    expect(localStorage.getItem(`settlement_intent_${mockCommitmentId}`)).toBeNull();
  });

  it("polls for recovery if localStorage has intent but status is not settled", async () => {
    localStorage.setItem(`settlement_intent_${mockCommitmentId}`, "12345");
    
    // Initial fetch
    globalFetch.mockResolvedValue({
      ok: true,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({
        commitment: { id: mockCommitmentId, status: "active" },
      }),
    });

    render(<SettlementReceipt commitmentId={mockCommitmentId} onTelemetry={mockTelemetry} />);

    await waitFor(() => {
      expect(screen.getByText(/recovering settlement state/i)).toBeInTheDocument();
    });

    // Should fetch again (after delay, so we might need a short timeout or just waitFor)
    await waitFor(() => {
      expect(globalFetch).toHaveBeenCalledTimes(2);
    }, { timeout: 3000 });
  });
});
