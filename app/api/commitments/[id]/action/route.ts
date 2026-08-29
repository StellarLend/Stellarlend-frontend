import { NextResponse } from "next/server";

// Simple in-memory store for tests/dev. Keyed by requestId -> { requestId, status, txHash }
const store = new Map<string, any>();

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const body = await req.json();
  const { action, requestId } = body ?? {};
  if (!action || !requestId) return NextResponse.json({ error: "missing" }, { status: 400 });

  // Idempotent behavior: if we've seen this requestId, return previous result
  if (store.has(requestId)) {
    return NextResponse.json(store.get(requestId));
  }

  // For test purposes: accept and produce a fake txHash for actions
  const txHash = `TX-${Math.random().toString(36).slice(2, 9)}`;
  const resp = { requestId, status: "accepted", txHash };
  store.set(requestId, resp);
  return NextResponse.json(resp);
}
