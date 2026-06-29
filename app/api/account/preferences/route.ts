import { NextRequest, NextResponse } from 'next/server';
import {
  PreferencesRepository,
  DEFAULT_NOTIFICATION_SETTINGS,
  type UpsertPreferencesInput,
} from '@/lib/account/preferences-repository';

// Singleton repository instance (will be replaced by a database-backed impl later)
const repo = new PreferencesRepository();

/**
 * GET /api/account/preferences?userId=<id>
 *
 * Returns the stored preferences for the given user, or 404 if none exist.
 */
export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get('userId');

  if (!userId) {
    return NextResponse.json(
      { error: 'Missing required query parameter: userId' },
      { status: 400 },
    );
  }

  const prefs = repo.getByUserId(userId);

  return NextResponse.json(
    prefs
      ? { email: user.email, ...prefs }
      : {
          userId: user.id,
          email: user.email,
          locale: "en-US",
          displayCurrency: "USD",
          notifications: { email: true, push: true, sms: false, inApp: true },
          updatedAt: null,
        }
  );
}

/**
 * PUT /api/account/preferences
 *
 * Upserts preferences for a user. Body must include `userId`, `locale`,
 * `displayCurrency`, and optionally `notifications` (defaults applied if omitted).
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();

    const { userId, locale, displayCurrency, notifications } = body as Partial<UpsertPreferencesInput>;

    if (!userId || !locale || !displayCurrency) {
      return NextResponse.json(
        { error: 'Missing required fields: userId, locale, displayCurrency' },
        { status: 400 },
      );
    }

    const input: UpsertPreferencesInput = {
      userId,
      locale,
      displayCurrency,
      notifications: notifications ?? DEFAULT_NOTIFICATION_SETTINGS,
    };

    const result = repo.upsert(input);
    return NextResponse.json(result, { status: 200 });
  } catch {
    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400 },
    );
  }
}
