import { NextResponse } from "next/server";
import type { LendingData } from "@/lib/lending/types";
import { calculateQuote, type LendingQuoteType } from "@/lib/lending/quote";

export const runtime = "nodejs";

type QuoteRequestBody = {
  type: LendingQuoteType;
  data: LendingData;
};

const invalidBody = () =>
  NextResponse.json(
    { error: { code: "INVALID_INPUT", message: "Invalid request body." } },
    { status: 400 }
  );

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return invalidBody();
  }

  const payload = body as Partial<QuoteRequestBody>;

  if (!payload || typeof payload !== "object") return invalidBody();

  if (
    payload.type !== "lend" &&
    payload.type !== "borrow"
  ) {
    return invalidBody();
  }

  if (!payload.data || typeof payload.data !== "object") return invalidBody();

  const outcome = calculateQuote(payload.type, payload.data as LendingData);

  if (!outcome.ok) {
    return NextResponse.json({ error: outcome.error }, { status: 400 });
  }

  return NextResponse.json({ result: outcome.result }, { status: 200 });
}

