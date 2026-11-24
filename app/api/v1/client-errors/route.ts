import { z } from "zod";
import { apiRateLimiter, getClientIp } from "@/lib/api/rate-limit";
import { errorResponse, jsonResponse } from "@/lib/api/response";
import { redactStellarIds, sanitizeContext } from "@/lib/report-error";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 8192; // 8 KB cap

const ClientErrorPayloadSchema = z.object({
  name: z.string().min(1),
  message: z.string(),
  stack: z.string().optional(),
  context: z.record(z.string(), z.unknown()).optional().default({}),
  timestamp: z.string().optional(),
});

export async function POST(request: Request): Promise<Response> {
  const rate = apiRateLimiter.check(getClientIp(request));
  if (!rate.allowed) {
    return errorResponse("RATE_LIMITED", "Too many requests", 429, {
      "Retry-After": String(rate.retryAfterSec),
    });
  }

  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > MAX_BODY_BYTES) {
    return new Response(JSON.stringify({ error: "Payload Too Large" }), {
      status: 413,
      headers: { "Content-Type": "application/json" },
    });
  }

  let bodyText = "";
  try {
    bodyText = await request.text();
  } catch {
    return new Response(JSON.stringify({ error: "Bad Request" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (Buffer.byteLength(bodyText, "utf8") > MAX_BODY_BYTES) {
    return new Response(JSON.stringify({ error: "Payload Too Large" }), {
      status: 413,
      headers: { "Content-Type": "application/json" },
    });
  }

  let json: unknown;
  try {
    json = JSON.parse(bodyText);
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const parsed = ClientErrorPayloadSchema.safeParse(json);
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: "Invalid schema", details: parsed.error.issues }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { name, message, stack, context, timestamp } = parsed.data;

  // Server-side re-sanitisation of addresses/secrets
  const sanitizedMessage = redactStellarIds(message);
  const sanitizedStack = stack ? redactStellarIds(stack) : undefined;
  const sanitizedCtx = sanitizeContext(context);

  const structuredLog = {
    type: "client_error",
    name,
    message: sanitizedMessage,
    stack: sanitizedStack,
    context: sanitizedCtx,
    timestamp: timestamp ?? new Date().toISOString(),
  };

  // Structured single line log
  console.error(JSON.stringify(structuredLog));

  return jsonResponse({ received: true }, 200, "no-store", request);
}
