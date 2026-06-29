// utils/notificationPreferences.ts
export interface ReminderPreference {
  reminderLeadTime?: number;
}

export async function fetchReminderPreference(): Promise<ReminderPreference | null> {
  try {
    const res = await fetch('/api/account/notification-preferences');
    if (!res.ok) return null;
    const data = await res.json();
    return data as ReminderPreference;
  } catch (e) {
    console.error('Failed to fetch reminder preference', e);
    return null;
  }
}

export async function saveReminderPreference(payload: ReminderPreference): Promise<void> {
  const res = await fetch('/api/account/notification-preferences', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error('Failed to save reminder preference');
  }
}
