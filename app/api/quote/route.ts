import { NextResponse } from "next/server";
import type { LendingData } from "@/lib/lending/types";
import { calculateQuote, type LendingQuoteType } from "@/lib/lending/quote";

export const runtime = "nodejs";

type QuoteRequestBody = {
  type: LendingQuoteType;
  data: LendingData;
};

const invalidBody = (message = "Invalid request body.") =>
  NextResponse.json(
    { error: { code: "INVALID_INPUT", message } },
    { status: 400 }
  );

function validateData(data: unknown): LendingData {
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("data must be an object");
  const seen = new Set<object>();
  const walk = (obj: Record<string, unknown>, path: string): void => {
    if (seen.has(obj)) throw new Error(`circular reference at ${path}`);
    seen.add(obj);
    for (const key of Object.keys(obj)) {
      if (key === "__proto__" || key === "constructor" || key === "prototype") {
        throw new Error(`forbidden key at ${path}.${key}`);
      }
      const val = obj[key];
      if (val === undefined) throw new Error(`undefined value at ${path}.${key}`);
      if (typeof val === "number") {
        if (!Number.isFinite(val) || Math.abs(val) > Number.MAX_SAFE_INTEGER) {
          throw new Error(`invalid number at ${path}.${key}`);
        }
      } else if (val && typeof val === "object") {
        walk(val as Record<string, unknown>, `${path}.${key}`);
      }
    }
  };
  walk(data as Record<string, unknown>, "data");
  return data as LendingData;
}

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type");
  if (!contentType || !contentType.toLowerCase().includes("application/json")) {
    return invalidBody("Content-Type must be application/json.");
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return invalidBody();
  }

  if (typeof body !== "object" || body === null || Array.isArray(body)) return invalidBody();

  const payload = body as Partial<QuoteRequestBody>;

  if (Object.keys(payload).some((k) => k !== "type" && k !== "data")) {
    return invalidBody();
  }

  if (payload.type !== "lend" && payload.type !== "borrow") {
    return invalidBody();
  }

  let data: LendingData;
  try {
    data = validateData(payload.data);
  } catch {
    return invalidBody();
  }

  let outcome;
  try {
    outcome = calculateQuote(payload.type, data);
  } catch {
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to calculate quote." } },
      { status: 500 }
    );
  }

  if (!outcome.ok) {
    return NextResponse.json({ error: outcome.error }, { status: 400 });
  }

  return NextResponse.json({ result: outcome.result }, { status: 200 });
}
