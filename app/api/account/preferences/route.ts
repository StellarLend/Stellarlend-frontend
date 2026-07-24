import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { validatePreferences } from "@/lib/account/preferences-validation";
import { preferencesRepository } from "@/lib/account/preferences-repository";
import { withCsrfProtection } from "@/lib/api/handler";

/**
 * GET /api/account/preferences
 *
 * Returns stored preferences for authenticated user, or default preferences.
 */
export async function GET(request: NextRequest) {
  const user = requireAuth(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const prefs = await preferencesRepository.getByUserId(user.id);
  if (!prefs) {
    return NextResponse.json({
      userId: user.id,
      email: user.email,
      locale: "en-US",
      displayCurrency: "USD",
      notifications: { email: true, push: true, sms: false, inApp: true },
      updatedAt: null,
    });
  }

  return NextResponse.json({ email: user.email, ...prefs });
}

/**
 * PUT /api/account/preferences
 *
 * Upserts preferences for authenticated user.
 */
async function putHandler(request: NextRequest) {
  const user = requireAuth(request);
  if (!user) {
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

  const record = await preferencesRepository.upsert(user.id, validation.data);
  return NextResponse.json(record);
}

export const PUT = withCsrfProtection(putHandler);
