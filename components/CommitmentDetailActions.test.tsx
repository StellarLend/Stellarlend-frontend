/**
 * Tests for CommitmentDetailActions component
 * Covers authorization, state machine, actions, error handling, and telemetry
 */

import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import CommitmentDetailActions from "./CommitmentDetailActions";
import type { Commitment, CommitmentActionType, ActionAuthorization } from "@/types/commitment";

global.fetch = vi.fn();

const baseMockCommitment: Commitment = {
  id: "test-commitment-123",
  status: "active",
  borrower: "GBTEST",
  lender: "GCTEST",
  asset: "XLM",
  amount: 1000,
  interestRate: 10,
  duration: 30,
  collateralAsset: "USDC",
  collateralAmount: 1500,
  fundedAmount: 1000,
  outstandingDebt: 1008.33,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const allActionsAllowed: Record<CommitmentActionType, ActionAuthorization> = {
  fund: { allowed: true },
  dispute: { allowed: true },
  early_exit: { allowed: true },
  settle: { allowed: true },
};

describe("CommitmentDetailActions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("State machine and authorization", () => {
    it("should show only allowed actions for pending status", () => {
      const commitment = { ...baseMockCommitment, status: "pending" as const };
      const canPerformActions = {
        fund: { allowed: true },
        dispute: { allowed: false, reason: "Not active yet" },
        early_exit: { allowed: false, reason: "Not active yet" },
        settle: { allowed: false, reason: "Not active yet" },
      };

      render(
        <CommitmentDetailActions commitment={commitment} canPerformActions={canPerformActions} />,
      );

      expect(screen.getByRole("button", { name: /fund commitment/i })).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /dispute/i })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /early exit/i })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /settle/i })).not.toBeInTheDocument();
    });

    it("should show actions for active status", () => {
      const commitment = { ...baseMockCommitment, status: "active" as const };

      render(
        <CommitmentDetailActions commitment={commitment} canPerformActions={allActionsAllowed} />,
      );

      expect(screen.queryByRole("button", { name: /fund/i })).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: /dispute/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /early exit/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /settle/i })).toBeInTheDocument();
    });

    it("should show no actions for settled status", () => {
      const commitment = { ...baseMockCommitment, status: "settled" as const };
      const canPerformActions = {
        fund: { allowed: false, reason: "Already settled" },
        dispute: { allowed: false, reason: "Already settled" },
        early_exit: { allowed: false, reason: "Already settled" },
        settle: { allowed: false, reason: "Already settled" },
      };

      render(
        <CommitmentDetailActions commitment={commitment} canPerformActions={canPerformActions} />,
      );

      expect(screen.getByText(/no actions available/i)).toBeInTheDocument();
      expect(screen.getByText(/settled/i)).toBeInTheDocument();
    });

    it("should disable button when action is not authorized", () => {
      const commitment = { ...baseMockCommitment, status: "active" as const };
      const canPerformActions = {
        ...allActionsAllowed,
        dispute: { allowed: false, reason: "Insufficient permissions" },
      };

      render(
        <CommitmentDetailActions commitment={commitment} canPerformActions={canPerformActions} />,
      );

      const disputeButton = screen.getByRole("button", { name: /dispute/i });
      expect(disputeButton).toBeDisabled();
      expect(screen.getByText(/insufficient permissions/i)).toBeInTheDocument();
    });
  });

  describe("Action execution", () => {
    it("should execute fund action successfully", async () => {
      const user = userEvent.setup();
      const commitment = { ...baseMockCommitment, status: "pending" as const };
      const onActionComplete = vi.fn();
      const canPerformActions = {
        fund: { allowed: true },
        dispute: { allowed: false },
        early_exit: { allowed: false },
        settle: { allowed: false },
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          transactionHash: "abc123",
          newStatus: "active",
        }),
      });

      render(
        <CommitmentDetailActions
          commitment={commitment}
          canPerformActions={canPerformActions}
          onActionComplete={onActionComplete}
        />,
      );

      const fundButton = screen.getByRole("button", { name: /fund commitment/i });
      await user.click(fundButton);

      // Should show loading state
      expect(screen.getByText(/processing/i)).toBeInTheDocument();

      await waitFor(() => {
        expect(onActionComplete).toHaveBeenCalledWith("fund", "active");
      });

      expect(global.fetch).toHaveBeenCalledWith(
        "/api/commitments/test-commitment-123/actions",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            action: "fund",
            commitmentId: commitment.id,
          }),
        }),
      );

      // Should show success state
      expect(screen.getByText(/success/i)).toBeInTheDocument();
    });

    it("should handle action failure", async () => {
      const user = userEvent.setup();
      const commitment = { ...baseMockCommitment, status: "active" as const };

      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
      });

      render(
        <CommitmentDetailActions commitment={commitment} canPerformActions={allActionsAllowed} />,
      );

      const disputeButton = screen.getByRole("button", { name: /dispute/i });
      await user.click(disputeButton);

      await waitFor(() => {
        expect(screen.getByText(/error/i)).toBeInTheDocument();
        expect(screen.getByText(/500/i)).toBeInTheDocument();
      });
    });

    it("should handle rate limiting", async () => {
      const user = userEvent.setup();
      const commitment = { ...baseMockCommitment, status: "active" as const };

      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 429,
        statusText: "Too Many Requests",
      });

      render(
        <CommitmentDetailActions commitment={commitment} canPerformActions={allActionsAllowed} />,
      );

      const settleButton = screen.getByRole("button", { name: /settle/i });
      await user.click(settleButton);

      await waitFor(() => {
        expect(screen.getByText(/rate limited/i)).toBeInTheDocument();
      });
    });

    it("should handle authorization errors", async () => {
      const user = userEvent.setup();
      const commitment = { ...baseMockCommitment, status: "active" as const };

      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 403,
        statusText: "Forbidden",
      });

      render(
        <CommitmentDetailActions commitment={commitment} canPerformActions={allActionsAllowed} />,
      );

      const disputeButton = screen.getByRole("button", { name: /dispute/i });
      await user.click(disputeButton);

      await waitFor(() => {
        expect(screen.getByText(/not authorized/i)).toBeInTheDocument();
      });
    });

    it("should handle conflict errors", async () => {
      const user = userEvent.setup();
      const commitment = { ...baseMockCommitment, status: "active" as const };

      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 409,
        statusText: "Conflict",
      });

      render(
        <CommitmentDetailActions commitment={commitment} canPerformActions={allActionsAllowed} />,
      );

      const earlyExitButton = screen.getByRole("button", { name: /early exit/i });
      await user.click(earlyExitButton);

      await waitFor(() => {
        expect(screen.getByText(/conflicts with current/i)).toBeInTheDocument();
      });
    });

    it("should prevent concurrent execution of same action", async () => {
      const user = userEvent.setup();
      const commitment = { ...baseMockCommitment, status: "active" as const };

      // Mock slow response
      (global.fetch as any).mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  ok: true,
                  json: async () => ({ success: true, newStatus: "settled" }),
                }),
              100,
            ),
          ),
      );

      render(
        <CommitmentDetailActions commitment={commitment} canPerformActions={allActionsAllowed} />,
      );

      const settleButton = screen.getByRole("button", { name: /settle/i });

      // Click twice rapidly
      await user.click(settleButton);
      await user.click(settleButton);

      // Should only make one request
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe("Error message sanitization", () => {
    it("should sanitize transaction hashes from error messages", async () => {
      const user = userEvent.setup();
      const commitment = { ...baseMockCommitment, status: "active" as const };
      const secretHash = "a".repeat(64);

      (global.fetch as any).mockRejectedValueOnce(
        new Error(`Transaction ${secretHash} failed`),
      );

      render(
        <CommitmentDetailActions commitment={commitment} canPerformActions={allActionsAllowed} />,
      );

      const disputeButton = screen.getByRole("button", { name: /dispute/i });
      await user.click(disputeButton);

      await waitFor(() => {
        const errorText = screen.getByRole("alert");
        expect(errorText).toHaveTextContent("[REDACTED]");
        expect(errorText).not.toHaveTextContent(secretHash);
      });
    });
  });

  describe("Telemetry", () => {
    it("should emit telemetry on action initiation", async () => {
      const user = userEvent.setup();
      const commitment = { ...baseMockCommitment, status: "active" as const };
      const onTelemetry = vi.fn();

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, newStatus: "disputed" }),
      });

      render(
        <CommitmentDetailActions
          commitment={commitment}
          canPerformActions={allActionsAllowed}
          onTelemetry={onTelemetry}
        />,
      );

      const disputeButton = screen.getByRole("button", { name: /dispute/i });
      await user.click(disputeButton);

      await waitFor(() => {
        expect(onTelemetry).toHaveBeenCalledWith(
          expect.objectContaining({
            type: "action_initiated",
            action: "dispute",
            status: "active",
          }),
        );
      });
    });

    it("should emit telemetry on action completion", async () => {
      const user = userEvent.setup();
      const commitment = { ...baseMockCommitment, status: "active" as const };
      const onTelemetry = vi.fn();

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          transactionHash: "test-hash",
          newStatus: "settled",
        }),
      });

      render(
        <CommitmentDetailActions
          commitment={commitment}
          canPerformActions={allActionsAllowed}
          onTelemetry={onTelemetry}
        />,
      );

      const settleButton = screen.getByRole("button", { name: /settle/i });
      await user.click(settleButton);

      await waitFor(() => {
        expect(onTelemetry).toHaveBeenCalledWith(
          expect.objectContaining({
            type: "action_completed",
            action: "settle",
            status: "settled",
          }),
        );
      });
    });

    it("should emit telemetry on action failure", async () => {
      const user = userEvent.setup();
      const commitment = { ...baseMockCommitment, status: "active" as const };
      const onTelemetry = vi.fn();

      (global.fetch as any).mockRejectedValueOnce(new Error("Network error"));

      render(
        <CommitmentDetailActions
          commitment={commitment}
          canPerformActions={allActionsAllowed}
          onTelemetry={onTelemetry}
        />,
      );

      const disputeButton = screen.getByRole("button", { name: /dispute/i });
      await user.click(disputeButton);

      await waitFor(() => {
        expect(onTelemetry).toHaveBeenCalledWith(
          expect.objectContaining({
            type: "action_failed",
            action: "dispute",
            errorType: "Error",
            errorMessage: "Network error",
          }),
        );
      });
    });

    it("should emit latency metrics", async () => {
      const user = userEvent.setup();
      const commitment = { ...baseMockCommitment, status: "active" as const };
      const onTelemetry = vi.fn();

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, newStatus: "settled" }),
      });

      render(
        <CommitmentDetailActions
          commitment={commitment}
          canPerformActions={allActionsAllowed}
          onTelemetry={onTelemetry}
        />,
      );

      const settleButton = screen.getByRole("button", { name: /settle/i });
      await user.click(settleButton);

      await waitFor(() => {
        expect(onTelemetry).toHaveBeenCalledWith(
          expect.objectContaining({
            type: "api_latency",
            latencyMs: expect.any(Number),
          }),
        );
      });
    });

    it("should emit state transition telemetry", async () => {
      const user = userEvent.setup();
      const commitment = { ...baseMockCommitment, status: "active" as const };
      const onTelemetry = vi.fn();

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, newStatus: "settled" }),
      });

      render(
        <CommitmentDetailActions
          commitment={commitment}
          canPerformActions={allActionsAllowed}
          onTelemetry={onTelemetry}
        />,
      );

      const settleButton = screen.getByRole("button", { name: /settle/i });
      await user.click(settleButton);

      await waitFor(() => {
        expect(onTelemetry).toHaveBeenCalledWith(
          expect.objectContaining({
            type: "state_transition",
            status: "settled",
            metadata: expect.objectContaining({
              previousStatus: "active",
              newStatus: "settled",
              triggeredBy: "settle",
            }),
          }),
        );
      });
    });
  });

  describe("Accessibility", () => {
    it("should have accessible button labels", () => {
      const commitment = { ...baseMockCommitment, status: "active" as const };

      render(
        <CommitmentDetailActions commitment={commitment} canPerformActions={allActionsAllowed} />,
      );

      expect(screen.getByRole("button", { name: /raise dispute/i })).toHaveAccessibleName();
      expect(screen.getByRole("button", { name: /request early exit/i })).toHaveAccessibleName();
      expect(screen.getByRole("button", { name: /settle commitment/i })).toHaveAccessibleName();
    });

    it("should indicate busy state with aria-busy", async () => {
      const user = userEvent.setup();
      const commitment = { ...baseMockCommitment, status: "active" as const };

      (global.fetch as any).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({ ok: true }), 100)),
      );

      render(
        <CommitmentDetailActions commitment={commitment} canPerformActions={allActionsAllowed} />,
      );

      const disputeButton = screen.getByRole("button", { name: /dispute/i });
      await user.click(disputeButton);

      expect(disputeButton).toHaveAttribute("aria-busy", "true");
    });

    it("should have proper role for error messages", async () => {
      const user = userEvent.setup();
      const commitment = { ...baseMockCommitment, status: "active" as const };

      (global.fetch as any).mockRejectedValueOnce(new Error("Test error"));

      render(
        <CommitmentDetailActions commitment={commitment} canPerformActions={allActionsAllowed} />,
      );

      const disputeButton = screen.getByRole("button", { name: /dispute/i });
      await user.click(disputeButton);

      await waitFor(() => {
        const alert = screen.getByRole("alert");
        expect(alert).toHaveTextContent(/error/i);
      });
    });
  });

  describe("Status display", () => {
    it("should display current commitment status", () => {
      const commitment = { ...baseMockCommitment, status: "active" as const };

      render(
        <CommitmentDetailActions commitment={commitment} canPerformActions={allActionsAllowed} />,
      );

      expect(screen.getByText(/current status/i)).toBeInTheDocument();
      expect(screen.getByText("active")).toBeInTheDocument();
    });

    it("should display last updated timestamp", () => {
      const commitment = {
        ...baseMockCommitment,
        updatedAt: new Date("2024-01-15T10:30:00Z").toISOString(),
      };

      render(
        <CommitmentDetailActions commitment={commitment} canPerformActions={allActionsAllowed} />,
      );

      expect(screen.getByText(/last updated/i)).toBeInTheDocument();
    });
  });
});
