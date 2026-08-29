/**
 * Commitment actions API endpoint
 * Handles fund, dispute, early_exit, and settle actions
 */

import { NextResponse } from "next/server";
import type {
  CommitmentActionRequest,
  CommitmentActionResponse,
  CommitmentStatus,
} from "@/types/commitment";
import { COMMITMENT_STATE_MACHINE } from "@/types/commitment";

/**
 * Simulate transaction processing delay
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * POST /api/commitments/[id]/actions
 * Execute commitment action
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body: CommitmentActionRequest = await request.json();

    const { action } = body;

    if (!action || !["fund", "dispute", "early_exit", "settle"].includes(action)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INVALID_ACTION",
            message: "Invalid action type",
          },
        },
        { status: 400 },
      );
    }

    // In production, fetch current commitment state from database
    // For now, we'll simulate based on the action
    const currentStatus: CommitmentStatus = "active"; // Mock current state

    // Validate action is allowed in current state
    const allowedActions = COMMITMENT_STATE_MACHINE[currentStatus] || [];
    if (!allowedActions.includes(action)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "ACTION_NOT_ALLOWED",
            message: `Action '${action}' is not allowed for status '${currentStatus}'`,
          },
        },
        { status: 409 },
      );
    }

    // Simulate transaction processing
    await delay(1000 + Math.random() * 2000); // 1-3 second delay

    // Determine new status based on action
    let newStatus: CommitmentStatus;
    switch (action) {
      case "fund":
        newStatus = "active";
        break;
      case "dispute":
        newStatus = "disputed";
        break;
      case "early_exit":
        newStatus = "early_exit";
        break;
      case "settle":
        newStatus = "settled";
        break;
      default:
        newStatus = currentStatus;
    }

    // Generate mock transaction hash
    const transactionHash = `${Date.now().toString(16)}${Math.random().toString(16).slice(2, 18)}`.padEnd(
      64,
      "0",
    );

    const response: CommitmentActionResponse = {
      success: true,
      transactionHash,
      newStatus,
    };

    return NextResponse.json(response, {
      headers: {
        "Cache-Control": "no-cache, no-store, must-revalidate",
      },
    });
  } catch (error) {
    console.error("Error processing action:", error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to process action",
        },
      },
      { status: 500 },
    );
  }
}
