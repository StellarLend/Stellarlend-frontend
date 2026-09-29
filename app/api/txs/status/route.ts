import { NextResponse } from "next/server";

// Very small in-memory status map for tests. txHash -> status
const txStatusMap = new Map<string, string>();

// Helper exported to tests via module caching in Node environment
(globalThis as any).__setTxStatus = (txHash: string, status: string) => {
  txStatusMap.set(txHash, status);
};

export async function GET(req: Request) {
  const url = new URL(req.url);
  const txHash = url.searchParams.get("txHash");
  if (!txHash) return NextResponse.json({ error: "missing" }, { status: 400 });
  const status = txStatusMap.get(txHash) ?? "pending";
  return NextResponse.json({ txHash, status });
}
