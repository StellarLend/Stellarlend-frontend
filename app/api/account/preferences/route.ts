import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { validatePreferences } from "@/lib/account/preferences-validation";
import { preferencesRepository } from "@/lib/account/preferences-repository";
import { withCsrfProtection } from "@/lib/api/handler";


export async function GET(_req: NextRequest): Promise<NextResponse> {
  let user;
  try {
    user = requireAuth(_req);
  } catch (res) {
    return res as NextResponse;
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


const putHandler = async (req: NextRequest): Promise<NextResponse> => {
  let user;
  try {
    user = requireAuth(req);
  } catch (res) {
    return res as NextResponse;
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const validation = validatePreferences(body);
  if (!validation.success) {
    return NextResponse.json({ errors: validation.errors }, { status: 422 });
  }

  const record = await preferencesRepository.upsert(user.id, validation.data);
  return NextResponse.json(record);
};

export const PUT = withCsrfProtection(putHandler);
