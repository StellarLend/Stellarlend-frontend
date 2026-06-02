import { db } from '@/lib/db';
import { notificationPreferences } from '@/lib/db/schema';
import { and, eq } from 'drizzle-orm';

export type Channel = 'email' | 'sms' | 'push' | 'in_app';
export type EventType = 'deposit' | 'liquidation_warning' | 'marketing' | 'system';

export interface NotificationPreference {
  userId: string;
  channel: Channel;
  eventType: EventType;
  enabled: boolean;
}

/**
 * Gets a user's notification preference for a specific channel and event type.
 * 
 * Default Policy:
 * - Marketing communications default to opted-out (false).
 * - System, deposit, and liquidation warnings default to opted-in (true).
 */
export async function getPreference(userId: string, channel: Channel, eventType: EventType): Promise<boolean> {
  const result = await db.select()
    .from(notificationPreferences)
    .where(
      and(
        eq(notificationPreferences.userId, userId),
        eq(notificationPreferences.channel, channel),
        eq(notificationPreferences.eventType, eventType)
      )
    )
    .limit(1);

  if (result.length === 0) {
    if (eventType === 'marketing') return false;
    return true; 
  }

  return result[0].enabled;
}

/**
 * Updates a user's notification preference.
 */
export async function updatePreference(userId: string, channel: Channel, eventType: EventType, enabled: boolean) {
  return db.insert(notificationPreferences)
    .values({ userId, channel, eventType, enabled, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: [notificationPreferences.userId, notificationPreferences.channel, notificationPreferences.eventType],
      set: { enabled, updatedAt: new Date() }
    });
}

/**
 * Fans out a notification to the requested channels, respecting user preferences.
 * 
 * Note on Email Content:
 * Ensure that all outbound emails contain a clear opt-out URL in the footer
 * allowing users to easily manage their event-specific and channel-specific notifications.
 */
export async function fanOutNotification(
  userId: string, 
  eventType: EventType, 
  payload: Record<string, any>, 
  channels: Channel[]
): Promise<Channel[]> {
  const sentChannels: Channel[] = [];
  
  for (const channel of channels) {
    const isEnabled = await getPreference(userId, channel, eventType);
    if (isEnabled) {
      if (channel === 'email') {
        payload.optOutUrl = `https://stellarlend.com/account/preferences?channel=email&eventType=${eventType}`;
      }
      
      console.log(`[Notification] Sending ${eventType} to ${userId} via ${channel}`);
      sentChannels.push(channel);
    } else {
      console.log(`[Notification] Skipped ${channel} for ${userId} (${eventType}) - opted out`);
    }
  }
  
  return sentChannels;
}