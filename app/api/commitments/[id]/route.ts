/**
 * Commitment detail API endpoint
 * Returns commitment data and action authorization
 */

import { NextResponse } from "next/server";
import type {
  Commitment,
  CommitmentDetailResponse,
  ActionAuthorization,
  CommitmentActionType,
} from "@/types/commitment";
import { COMMITMENT_STATE_MACHINE } from "@/types/commitment";

/**
 * GET /api/commitments/[id]
 * Fetch commitment details and action permissions
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    // In production, fetch from database or blockchain
    // This is a mock implementation for demonstration
    const mockCommitment: Commitment = {
      id,
      status: "active",
      borrower: "GBXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
      lender: "GCYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYY",
      asset: "XLM",
      amount: 10000,
      interestRate: 12.5,
      duration: 30,
      collateralAsset: "USDC",
      collateralAmount: 15000,
      fundedAmount: 10000,
      outstandingDebt: 10104.17, // Principal + accrued interest
      createdAt: new Date(Date.now() - 86400000 * 5).toISOString(), // 5 days ago
      updatedAt: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
      maturityDate: new Date(Date.now() + 86400000 * 25).toISOString(), // 25 days from now
      transactionHash: "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
    };

    // Determine allowed actions based on state machine
    const allowedActions = COMMITMENT_STATE_MACHINE[mockCommitment.status] || [];

    // Check authorization for each action
    const canPerformActions: Record<CommitmentActionType, ActionAuthorization> = {
      fund: {
        allowed: allowedActions.includes("fund"),
        reason: allowedActions.includes("fund")
          ? undefined
          : "Funding only available for pending commitments",
      },
      dispute: {
        allowed: allowedActions.includes("dispute"),
        reason: allowedActions.includes("dispute")
          ? undefined
          : "Disputes can only be raised on active commitments",
      },
      early_exit: {
        allowed: allowedActions.includes("early_exit"),
        reason: allowedActions.includes("early_exit")
          ? undefined
          : "Early exit only available for active commitments",
      },
      settle: {
        allowed: allowedActions.includes("settle"),
        reason: allowedActions.includes("settle")
          ? undefined
          : "Settlement not available in current state",
      },
    };

    const response: CommitmentDetailResponse = {
      commitment: mockCommitment,
      canPerformActions,
    };

    return NextResponse.json(response, {
      headers: {
        "Cache-Control": "no-cache, no-store, must-revalidate",
      },
    });
  } catch (error) {
    console.error("Error fetching commitment:", error);
    return NextResponse.json(
      { error: { message: "Failed to fetch commitment" } },
      { status: 500 },
    );
  }
}
