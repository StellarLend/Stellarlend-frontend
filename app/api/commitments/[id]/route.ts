/**
 * Commitment detail API endpoint
 * Returns commitment data and action authorization
 */

import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import type {
  Commitment,
  CommitmentDetailResponse,
  ActionAuthorization,
  CommitmentActionType,
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

function getCanPerformActions(status: Commitment["status"]): Record<CommitmentActionType, ActionAuthorization> {
  const allowedActions = COMMITMENT_STATE_MACHINE[status] || [];

  return {
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
}

/**
 * GET /api/commitments/[id]
 * Fetch commitment details and action permissions
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getUser();
    if (!user || !user.walletAddress) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: rawId } = await params;
    const id = normalizeCommitmentId(rawId);

    if (!isValidCommitmentId(id)) {
      return NextResponse.json({ error: "Invalid commitment id" }, { status: 400 });
    }

    const commitment = MOCK_COMMITMENTS[id] ?? null;
    if (!commitment) {
      return NextResponse.json({ error: "Commitment not found" }, { status: 404 });
    }

    if (user.walletAddress !== commitment.borrower && user.walletAddress !== commitment.lender) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const response: CommitmentDetailResponse = {
      commitment,
      canPerformActions: getCanPerformActions(commitment.status),
    };

    return NextResponse.json(response, {
      headers: {
        "Cache-Control": "no-cache, no-store, must-revalidate",
      },
    });
  } catch (error) {
    console.error("Error fetching commitment:", error);
    return NextResponse.json({ error: { message: "Failed to fetch commitment" } }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!isValidId(id)) return NextResponse.json({ error: { message: "Invalid commitment id" } }, { status: 400 });
    const userRole = request.headers.get("x-user-role");
    if (userRole !== "borrower") return NextResponse.json({ error: { message: "Forbidden: Only the borrower can update a draft" } }, { status: 403 });
    const draft = await request.json().catch(() => null);
    if (!draft || typeof draft !== "object" || Array.isArray(draft)) return NextResponse.json({ error: { message: "Invalid request body" } }, { status: 400 });
    const commitment = getCommitment(id, "draft");
    if (!commitment) return NextResponse.json({ error: { message: "Draft commitment not found or not in draft state" } }, { status: 404 });
    const allowedFields = ["amount", "interestRate", "duration", "collateralAsset", "collateralAmount"] as const;
    const updates: Partial<Commitment> = {};
    for (const field of allowedFields) {
      if (field in draft) {
        const value = (draft as Record<string, unknown>)[field];
        if (field === "amount" || field === "collateralAmount" || field === "interestRate" || field === "duration") {
          if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return NextResponse.json({ error: { message: `Froperty ${field} must be a positive number` } }, { status: 400 });
        }
        if (field === "collateralAsset") {
          if (typeof value !== "string" || value.trim() === "") return NextResponse.json({ error: { message: "collateralAsset must be a non-empty string" } }, { status: 400 });
        }
        updates[field] = value as never;
      }
    }
    if (Object.keys(updates).length === 0) return NextResponse.json({ error: { message: "No valid fields to update" } }, { status: 400 });
    const updated: Commitment = { ...commitment, ...updates, updatedAt: new Date().toISOString() };
    commitments.set(id, updated);
    return NextResponse.json({ commitment: updated, canFormActions: buildAuth(updated) }, { headers: { "Cache-Control": "no-cache, no-store, must-revalidate" } });
  } catch (error) {
    console.error("Error updating commitment:", error);
    return NextResponse.json({ error: { message: "Failed to update commitment" } }, { status: 500 });
  }
}