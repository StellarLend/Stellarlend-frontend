import { NextRequest, NextResponse } from 'next/server';
import {
  DEFAULT_NOTIFICATION_SETTINGS,
  PreferencesRepository,
  type UpsertPreferencesInput,
} from '@/lib/account/preferences-repository';
import { validateAccountNotificationPreferences } from '@/lib/account/preferences-validation';

const repo = new PreferencesRepository();

/**
 * GET /api/account/notification-preferences?userId=<id>
 *
 * Returns the stored account notification preferences for the given user, or
 * 404 if no preference record exists yet.
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

  if (!prefs) {
    return NextResponse.json(
      { error: 'Notification preferences not found for the specified user' },
      { status: 404 },
    );
  }

  return NextResponse.json(prefs, { status: 200 });
}

/**
 * PUT /api/account/notification-preferences
 *
 * Upserts account notification preferences, including row-level liquidation
 * alert subscription keys such as `liquidation:XLM:USDC`.
 */
export async function PUT(request: NextRequest) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400 },
    );
  }

  const result = validateAccountNotificationPreferences(body);

  if (!result.success) {
    return NextResponse.json(
      { error: 'Invalid notification preferences', errors: result.errors },
      { status: 422 },
    );
  }

  const input: UpsertPreferencesInput = {
    ...result.data,
    notifications: result.data.notifications ?? DEFAULT_NOTIFICATION_SETTINGS,
  };

  return NextResponse.json(repo.upsert(input), { status: 200 });
}
