/**
 * Commitment actions API endpoint
 * Handles fund, dispute, early_exit, and settle actions
 */

import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import type {
  Commitment,
  CommitmentActionRequest,
  CommitmentActionResponse,
  CommitmentStatus,
} from "@/types/commitment";
import { COMMITMENT_STATE_MACHINE } from "@/types/commitment";

const BORROWER_WALLET = "G" + "A".repeat(55);
const LENDER_WALLET = "G" + "B".repeat(55);
const VALID_COMMITMENT_ID = /^[a-zA-Z0-9][a-zA-Z0-9-]{1,63}$/;

const MOCK_COMMITMENTS: Record<string, Commitment> = {
  "commitment-123": {
    id: "commitment-123",
    status: "active",
    borrower: BORROWER_WALLET,
    lender: LENDER_WALLET,
    asset: "XLM",
    amount: 10000,
    interestRate: 12.5,
    duration: 30,
    collateralAsset: "USDC",
    collateralAmount: 15000,
    fundedAmount: 10000,
    outstandingDebt: 10104.17,
    createdAt: new Date(Date.now() - 86400000 * 5).toISOString(),
    updatedAt: new Date(Date.now() - 3600000).toISOString(),
    maturityDate: new Date(Date.now() + 86400000 * 25).toISOString(),
    transactionHash: "a".repeat(64),
  },
  "valid-id": {
    id: "valid-id",
    status: "pending",
    borrower: BORROWER_WALLET,
    lender: LENDER_WALLET,
    asset: "XLM",
    amount: 5000,
    interestRate: 11.25,
    duration: 14,
    collateralAsset: "USDC",
    collateralAmount: 8000,
    fundedAmount: 0,
    outstandingDebt: 0,
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 3600000).toISOString(),
    maturityDate: new Date(Date.now() + 86400000 * 9).toISOString(),
    transactionHash: "b".repeat(64),
  },
};

function normalizeCommitmentId(rawId: unknown): string {
  return typeof rawId === "string" ? rawId.trim() : "";
}

function isValidCommitmentId(id: string): boolean {
  return typeof id === "string" && id.length > 1 && VALID_COMMITMENT_ID.test(id);
}

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
    const user = await getUser();
    if (!user || !user.walletAddress) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: routeId } = await params;
    const routeCommitmentId = normalizeCommitmentId(routeId);

    if (!isValidCommitmentId(routeCommitmentId)) {
      return NextResponse.json({ error: "Invalid commitment id" }, { status: 400 });
    }

    const body = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ error: "Invalid action payload" }, { status: 400 });
    }

    const payload = body as Partial<CommitmentActionRequest>;
    const action = payload.action;

    if (typeof payload.commitmentId !== "string") {
      return NextResponse.json({ error: "Invalid action payload" }, { status: 400 });
    }

    const commitmentId = normalizeCommitmentId(payload.commitmentId);
    if (commitmentId !== routeCommitmentId) {
      return NextResponse.json({ error: "Commitment id mismatch" }, { status: 400 });
    }

    if (!action || !["fund", "dispute", "early_exit", "settle"].includes(action)) {
      return NextResponse.json({ error: "Invalid action payload" }, { status: 400 });
    }

    if (
      payload.metadata !== undefined &&
      (typeof payload.metadata !== "object" || Array.isArray(payload.metadata) || payload.metadata === null)
    ) {
      return NextResponse.json({ error: "Invalid action payload" }, { status: 400 });
    }

    if (
      payload.signedEnvelopeXdr !== undefined &&
      typeof payload.signedEnvelopeXdr !== "string"
    ) {
      return NextResponse.json({ error: "Invalid action payload" }, { status: 400 });
    }

    const commitment = MOCK_COMMITMENTS[routeCommitmentId] ?? null;
    if (!commitment) {
      return NextResponse.json({ error: "Commitment not found" }, { status: 404 });
    }

    if (user.walletAddress !== commitment.borrower && user.walletAddress !== commitment.lender) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const currentStatus: CommitmentStatus = commitment.status;
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

    await delay(1000 + Math.random() * 2000);

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

    const response: CommitmentActionResponse = {
      success: true,
      transactionHash: "c".repeat(64),
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
