import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { validatePreferences } from "@/lib/account/preferences-validation";
import { preferencesRepository } from "@/lib/account/preferences-repository";
import { withCsrfProtection } from "@/lib/api/handler";

export const runtime = "nodejs";

/**
 * GET /api/account/preferences
 */
export async function GET(request: NextRequest) {
  let user: any;
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof Response) {
      return authResult;
    }
    user = authResult;
    if (!user || !user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const prefs = preferencesRepository.getByUserId(user.id);
  if (!prefs) {
    return NextResponse.json({
      userId: user.id,
      locale: "en-US",
      displayCurrency: "USD",
      notifications: { email: true, push: true, sms: false, inApp: true },
      updatedAt: null,
    }, { status: 200 });
  }

  return NextResponse.json(prefs, { status: 200 });
}

/**
 * PUT /api/account/preferences
 */
async function putHandler(request: NextRequest) {
  let user: any;
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof Response) {
      return authResult as unknown as NextResponse;
    }
    user = authResult;
    if (!user || !user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const validation = validatePreferences(body);
  if (!validation.success) {
    return NextResponse.json({ errors: validation.errors }, { status: 422 });
  }

  const record = preferencesRepository.upsert(user.id, validation.data);
  return NextResponse.json(record, { status: 200 });
}

export const PUT = withCsrfProtection(putHandler);