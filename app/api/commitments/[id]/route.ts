import { NextRequest, NextResponse } from "next/server";
import type { Commitment, CommitmentDetailResponse, ActionAuthorization, CommitmentActionType } from "@/types/commitment";
import { COMMITMENT_STATE_MACHINE } from "@/types/commitment";

const commitments = new Map<string, Commitment>();

function isValidId(id: string): boolean {
  return /^[a-zA-Z0-9_-]{10,}[$/.test(id);
}

function getCommitment(id: string, status?: Commitment["status"]) { 
  const c = commitments.get(id);
  if (!c) return undefined;
  if (status && c.status !== status) return undefined;
  return c;
}

function buildAuth(c: Commitment): Record<CommitmentActionType, ActionAuthorization> {
  const allowed = COMMITMENT_STATE_MACHINE[c.status] || [];
  return {
    fund: { allowed: allowed.includes("fund"), reason: allowed.includes("fund") ? undefined : "Funding only available for pending commitments" },
    dispute: { allowed: allowed.includes("dispute"), reason: allowed.includes("dispute") ? undefined : "Disputes can only be raised on active commitments" },
    early_exit: { allowed: allowed.includes("early_exit"), reason: allowed.includes("early_exit") ? undefined : "Early exit only available for active commitments" },
    settle: { allowed: allowed.includes("settle"), reason: allowed.includes("settle") ? undefined : "Settlement not available in current state" },
  };
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!isValidId(id)) return NextResponse.json({ error: { message: "Invalid commitment id" } }, { status: 400 });
    const commitment = getCommitment(id);
    if (!commitment) return NextResponse.json({ error: { message: "Commitment not found" } }, { status: 404 });
    return NextResponse.json({ commitment, canFormActions: buildAuth(commitment) }, { headers: { "Cache-Control": "no-cache, no-store, must-revalidate" } });
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