import { NextResponse } from "next/server";

// Simple in-memory store for tests/dev. Keyed by requestId -> { requestId, status, txHash }
const store = new Map<string, any>();

const SUPPORTED_ACTIONS = new Set(["fund", "dispute", "early-exit", "settle"]);

export async function POST(req: Request, { params }: { params: { id: string } }) {
  // Validate route parameter
  if (!params.id || !/^[a-zA-Z0-9-]+$/.test(params.id)) {
    return NextResponse.json({ error: "invalid commitment id" }, { status: 400 });
  }

  // Validate wallet identity (disconnected-wallet boundary)
  const walletAddress = req.headers.get("x-wallet-address");
  if (!walletAddress || !/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
    return NextResponse.json({ error: "unauthorized: invalid or missing wallet" }, { status: 401 });
  }

  // Validate network (wrong-network boundary)
  const network = req.headers.get("x-network");
  if (!network || !["mainnet", "testnet"].includes(network)) {
    return NextResponse.json({ error: "unsupported network" }, { status: 400 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "malformed JSON" }, { status: 400 });
  }
  const { action, requestId, amount } = body ?? {};

  if (!action || !SUPPORTED_ACTIONS.has(action)) {
    return NextResponse.json({ error: "unsupported action" }, { status: 400 });
  }
  if (!requestId || typeof requestId !== "string" || !/^[a-zA-Z0-9-]+$/.test(requestId)) {
    return NextResponse.json({ error: "invalid requestId" }, { status: 400 });
  }

  // Validate numeric values (e.g., amount for fund/early-exit)
  if (amount !== undefined) {
    if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: "invalid amount" }, { status: 400 });
    }
  }

  // Idempotent behavior: replay with same requestId returns the original response
  if (store.has(requestId)) {
    return NextResponse.json(store.get(requestId));
  }

  // For test purposes: accept and produce a fake txHash for actions
  const txHash = `TX-${Math.random().toString(36).slice(2, 9)}`;
  const resp = { requestId, status: "accepted", txHash };
  store.set(requestId, resp);
  return NextResponse.json(resp);
}
