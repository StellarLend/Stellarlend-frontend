import { NextResponse } from 'next/server';
import { updatePreference, Channel, EventType } from '@/lib/notifications/repository';
import { getUser } from '@/lib/auth';

/**
 * @swagger
 * /api/account/notification-preferences:
 *   patch:
 *     summary: Update notification preferences
 *     description: Update per-channel, per-event opt-in/out preferences.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               preferences:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     channel:
 *                       type: string
 *                       enum: [email, sms, push, in_app]
 *                     eventType:
 *                       type: string
 *                       enum: [deposit, liquidation_warning, marketing, system]
 *                     enabled:
 *                       type: boolean
 *     responses:
 *       200:
 *         description: Preferences updated successfully
 *       400:
 *         description: Invalid payload format
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal Server Error
 */
export async function PATCH(request: Request) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const userId = (user as any).id || user.name || 'default-user';

    const body = await request.json();
    const { preferences } = body;

    if (!Array.isArray(preferences)) {
      return NextResponse.json({ error: 'Invalid payload: preferences must be an array' }, { status: 400 });
    }

    const updated = [];
    for (const pref of preferences) {
      const { channel, eventType, enabled } = pref;
      if (!channel || !eventType || typeof enabled !== 'boolean') {
        return NextResponse.json({ error: 'Invalid preference object. Expected { channel, eventType, enabled }' }, { status: 400 });
      }
      await updatePreference(userId, channel as Channel, eventType as EventType, enabled);
      updated.push({ channel, eventType, enabled });
    }
    return NextResponse.json({ message: 'Preferences updated successfully', preferences: updated }, { status: 200 });
  } catch (error) {
    console.error('Failed to update notification preferences:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}