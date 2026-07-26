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

  if (!prefs) {
    return NextResponse.json(
      { error: 'Preferences not found for the specified user' },
      { status: 404 },
    );
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
