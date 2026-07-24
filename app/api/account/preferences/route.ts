import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { validatePreferences } from "@/lib/account/preferences-validation";
import { preferencesRepository } from "@/lib/account/preferences-repository";
import { withCsrfProtection } from "@/lib/api/handler";

/**
 * GET /api/account/preferences
 *
 * Returns the stored preferences for the logged-in user, or default preferences if none exist.
 */
export async function GET(request: NextRequest) {
  try {
    const user = requireAuth(request);
    if (user instanceof NextResponse) return user;

    const prefs = await preferencesRepository.getByUserId(user.id);

    if (prefs) {
      return NextResponse.json({
        email: user.email,
        ...prefs,
      });
    }

    return NextResponse.json({
      userId: user.id,
      email: user.email,
      locale: "en-US",
      displayCurrency: "USD",
      notifications: { email: true, push: true, sms: false, inApp: true },
      updatedAt: null,
    });
  } catch (error) {
    if (error instanceof NextResponse) {
      return error;
    }
    throw error;
  }
}

/**
 * PUT /api/account/preferences
 *
 * Upserts preferences for the logged-in user.
 */
async function putHandler(request: NextRequest) {
  try {
    const user = requireAuth(request);
    if (user instanceof NextResponse) return user;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 }
      );
    }

    const validation = validatePreferences(body);
    if (!validation.success) {
      return NextResponse.json({ errors: validation.errors }, { status: 422 });
    }

    const record = await preferencesRepository.upsert(user.id, validation.data);
    return NextResponse.json(record);
  } catch (error) {
    if (error instanceof NextResponse) {
      return error;
    }
    throw error;
  }
}

export const PUT = withCsrfProtection(putHandler);
