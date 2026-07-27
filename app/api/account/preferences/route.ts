import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { withCsrfProtection } from '@/lib/api/handler';
import {
  PreferencesRepository,
  DEFAULT_NOTIFICATION_SETTINGS,
} from '@/lib/account/preferences-repository';
import { validatePreferences } from '@/lib/account/preferences-validation';

const repo = new PreferencesRepository();

export async function GET(request: NextRequest) {
  const user = getAuthUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const prefs = repo.getByUserId(user.id);

  if (!prefs) {
    return NextResponse.json({
      userId: user.id,
      locale: 'en-US',
      displayCurrency: 'USD',
      notifications: {
        ...DEFAULT_NOTIFICATION_SETTINGS,
        email: true,
        push: true,
        sms: false,
        inApp: true,
      },
      createdAt: null,
      updatedAt: null,
    });
  }

  return NextResponse.json(prefs);
}

async function putHandler(request: NextRequest) {
  const user = getAuthUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400 },
    );
  }

  const validation = validatePreferences(body);
  if (!validation.success) {
    return NextResponse.json({ errors: validation.errors }, { status: 422 });
  }

  const record = repo.upsert(user.id, validation.data);
  return NextResponse.json(record);
}

export const PUT = withCsrfProtection(putHandler);
