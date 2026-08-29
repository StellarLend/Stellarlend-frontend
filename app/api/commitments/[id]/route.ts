/**
 * Commitment detail API endpoint
 * Returns commitment data and action authorization
 *
 * This endpoint enforces strict validation and authorization boundaries:
 * - Route parameters are validated to reject tampered or malformed IDs.
 * - Wallet identity x-wallet-address is validated via Stellar address regex.
 * - Network x-network is validated and must match the commitment's network.
 * - Commitment data is validated to ensure no malformed numeric values.
 * - Ownership checks ensure a wallet can only perform actions it is authorized for.
 * - No-store caching prevents replay of stale responses.
 */

import { NextResponse } from "next/server";
import type {
  Commitment,
  CommitmentDetailResponse,
  ActionAuthorization,
  CommitmentActionType,
} from "@/types/commitment";
import { COMMITMENT_STATE_MACHINE } from "@/types/commitment";

const SUPPORTED_NETWORKS = ["mainnet", "testnet", "standalone"] as const;
type Network = (typeof SUPPORTED_NETWORKS)[number];

// Stellar public key: G followed by 55 uppercase base32 chars => 56 chars total
const STELLAR_ADDRESS_REGEX = /^G[ABCDEFGHIJKLMNOPQRSTUVWXYZ234567]{55}$/;

// Commitment IDs in this system are 64-character lowercase hex hashes
const COMMITMENT_ID_REGEX = /^[a-f0-9]{64}$/;

interface CommitmentWithNetwork extends Commitment {
  network: Network;
}

/**
 * Validate all numeric fields and addresses on a commitment.
 * This protects against malformed data from persistence/blockchain layers.
 */
function validateCommitment(commitment: Commitment): boolean {
  return (typeof commitment.amount === "number" &&
    isFinite(commitment.amount) &&
    commitment.amount > 0 &&
    typeof commitment.interestRate === "number" &&
    isFinite(commitment.interestRate) &&
    commitment.interestRate >= 0 &&
    typeof commitment.duration === "number" &&
    isFinite(commitment.duration) &&
    commitment.duration > 0 &&
    typeof commitment.collateralAmount === "number" &&
    isFinite(commitment.collateralAmount) &&
    commitment.collateralAmount > 0 &&
    typeof commitment.fundedAmount === "number" &&
    isFinite(commitment.fundedAmount) &&
    commitment.fundedAmount >= 0 &&
    typeof commitment.outstandingDebt === "number" &&
    isFinite(commitment.outstandingDebt) &&
    commitment.outstandingDebt >= 0 &&
    STELLAR_ADDRESS_REGEX.test(commitment.borrower) &&
    STELLAR_ADDRESS_REGEX.test(commitment.lender)
  );
}

function isParticipant(wallet: string, commitment: Commitment): boolean {
  return wallet === commitment.borrower || wallet === commitment.lender;
}

function isLender(wallet: string, commitment: Commitment): boolean {
  return wallet === commitment.lender;
}

function isBorrower(wallet: string, commitment: Commitment): boolean {
  return wallet === commitment.borrower;
}

/***
 * Determine authorization for a specific action given the request's identity.
 * Ownership is checked server-side against the commitment's borrower/lender fields,
 * never inferred from client state.
 */
function getAuthorization(
  action: CommitmentActionType,
  commitment: Commitment,
  wallet: string | null,
  network: Network | null,
  stateAllowed: boolean,
): ActionAuthorization {
  // A connected wallet is required for any action.
  if (!wallet) {
    return { allowed: false, reason: "Wallet not connected" };
  }

  let roleAuthorized: boolean;
  let roleRequirement: string;

  switch (action) {
    case "fund":
      roleAuthorized = isLender(wallet, commitment);
      roleRequirement = "the lender";
      break;
    case "dispute":
      roleAuthorized = isParticipant(wallet, commitment);
      roleRequirement = "the borrower or lender";
      break;
    case "early_exit":
      roleAuthorized = isBorrower(wallet, commitment);
      roleRequirement = "the borrower";
      break;
    case "settle":
      roleAuthorized = isParticipant(wallet, commitment);
      roleRequirement = "the borrower or lender";
      break;
    default:
      return { allowed: false, reason: "Unknown action" };
  }

  if (!roleAuthorized) {
    return { allowed: false, reason: `Not authorized as ${roleRequirement}` };
  }

  if (!stateAllowed) {
    return {
      allowed: false,
      reason: `Action not permitted in current status: ${commitment.status}`,
    };
  }

  return { allowed: true };
}

/***
 * GET /api/commitments/[id]
 * Fetch commitment details and action permissions.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    // --- Hostile input boundary: validate route parameter ---
    if (!COMMITMENT_ID_REGEX.test(id)) {
      return NextResponse.json(
        { error: { message: "Invalid commitment id" } },
        { status: 400 },
      );
    }

    // --- Validate network header ---
    const networkHeader = request.headers.get("x-network");
    if (
      !networkHeader ||
      !SUPPORTED_NETWORKS.includes(networkHeader as Network)
    ) {
      return NextResponse.json(
        {
          error: {
            message: `Missing or unsupported network. Supported: ${SUPPORTED_NETWORKS.join(", ")}`,
          },
        },
        { status: 400 },
      );
    }
    const network = networkHeader as Network;

    // --- Validate wallet identity header (optional for reading, required for actions) ---
    const walletHeader = request.headers.get("x-wallet-address");
    let wallet: string | null = null;
    if (walletHeader) {
      if (!STELLAR_ADDRESS_REGEX.test(walletHeader)) {
        return NextResponse.json(
          { error: { message: "Invalid wallet address" } },
          { status: 401 },
        );
      }
      wallet = walletHeader;
    }

    // In production, fetch from database or blockchain.
    // This is a mock implementation for demonstration.
    const mockCommitment: CommitmentWithNetwork = {
      id,
      status: "active",
      network: "mainnet", // This commitment is deployed on mainnet
      borrower: "GBXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
      lender: 'GCYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYY',
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
      transactionHash:
        "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
    };

    // --- Validate data retrieved from persistence/blockchain (malformed-response boundary) ---
    if (!validateCommitment(mockCommitment)) {
      return NextResponse.json(
        { error: { message: "Invalid commitment data" } },
        { status: 500 },
      );
    }

    // --- Enforce network match ---
    if (mockCommitment.network !== network) {
      return NextResponse.json(
        {
          error: {
            message: `Network mismatch: commitment is on ${mockCommitment.network}`,
          },
        },
        { status: 400 },
      );
    }

    // Determine allowed actions based on the authoritative state machine.
    const stateAllowedActions =
      COMMITMENT_STATE_MACHINE[mockCommitment.status] || [];

    // Build action authorizations with ownership checks.
    const canPerformActions: Record<
      CommitmentActionType,
      ActionAuthorization
    > = {
      fund: getAuthorization(
        "fund",
        mockCommitment,
        wallet,
        network,
        stateAllowedActions.includes("fund"),
      ),
      dispute: getAuthorization(
        "dispute",
        mockCommitment,
        wallet,
        network,
        stateAllowedActions.includes("dispute"),
      ),
      early_exit: getAuthorization(
        "early_exit",
        mockCommitment,
        wallet,
        network,
        stateAllowedActions.includes("early_exit"),
      ),
      settle: getAuthorization(
        "settle",
        mockCommitment,
        wallet,
        network,
        stateAllowedActions.includes("settle"),
      ),
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