import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { validatePreferences } from "@/lib/account/preferences-validation";
import { preferencesRepository } from "@/lib/account/preferences-repository";
import { withCsrfProtection } from "@/lib/api/handler";

export async function GET(request: NextRequest) {
  const user = getAuthUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const prefs = await preferencesRepository.getByUserId(user.id);

  return NextResponse.json(
    prefs ?? {
      userId: user.id,
      locale: "en-US",
      displayCurrency: "USD",
      notifications: { email: true, push: true, sms: false, inApp: true },
      updatedAt: null,
    }
  );
}

const putHandler = async (request: NextRequest) => {
  const user = getAuthUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const validation = validatePreferences(body);
  if (!validation.success) {
    return NextResponse.json({ errors: validation.errors }, { status: 422 });
  }

  const record = await preferencesRepository.upsert(user.id, validation.data);
  return NextResponse.json(record);
};

export const PUT = withCsrfProtection(putHandler);
