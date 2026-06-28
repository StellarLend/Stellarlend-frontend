// components/features/dashboard/components/NextPaymentDue.tsx
import React, { useEffect, useState } from 'react';
import { fetchReminderPreference, saveReminderPreference } from '@/utils/notificationPreferences';

// Accessible lead‑time options (in days)
const LEAD_TIME_OPTIONS = [
  { label: '1 day before', value: 1 },
  { label: '3 days before', value: 3 },
  { label: '7 days before', value: 7 },
];

export default function NextPaymentDue({ nextDue }: { nextDue?: string }) {
  const [selected, setSelected] = useState<number | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'saving' | 'saved' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState<string>('');

  // Load existing preference on mount
  useEffect(() => {
    if (!nextDue) return; // No payment due – keep disabled
    setStatus('loading');
    fetchReminderPreference()
      .then((pref) => {
        if (pref?.reminderLeadTime) setSelected(pref.reminderLeadTime);
        setStatus('idle');
      })
      .catch(() => {
        setStatus('error');
        setErrorMsg('Failed to load reminder preference');
      });
  }, [nextDue]);

  // Debounced save – fires 800 ms after last change
  useEffect(() => {
    if (status !== 'idle' || selected === null) return;
    const timer = setTimeout(() => {
      setStatus('saving');
      saveReminderPreference({ reminderLeadTime: selected })
        .then(() => setStatus('saved'))
        .catch(() => {
          setStatus('error');
          setErrorMsg('Failed to save reminder');
        });
    }, 800);
    return () => clearTimeout(timer);
  }, [selected, status]);

  // If there is no upcoming payment, explain why the control is disabled
  if (!nextDue) {
    return (
      <div className="p-4 bg-gray-100 rounded-md text-sm">
        No payment is currently due – reminder scheduling is unavailable.
      </div>
    );
  }

  return (
    <section className="my-4 p-4 border rounded-lg bg-white shadow-sm">
      <h2 className="text-lg font-medium mb-2">Payment reminder</h2>
      <p className="text-sm mb-3">Your next payment is {nextDue}. Choose when you would like to be reminded:</p>
      <fieldset className="flex flex-col gap-2" aria-describedby="reminder-status" disabled={status === 'loading'}>
        {LEAD_TIME_OPTIONS.map((opt) => (
          <label key={opt.value} className="inline-flex items-center gap-2">
            <input
              type="radio"
              name="reminderLeadTime"
              value={opt.value}
              checked={selected === opt.value}
              onChange={() => setSelected(opt.value)}
              className="form-radio h-4 w-4 text-indigo-600"
            />
            {opt.label}
          </label>
        ))}
      </fieldset>
      <div id="reminder-status" className="sr-only" aria-live="polite">
        {status === 'saving' && 'Saving reminder…'}
        {status === 'saved' && 'Reminder saved'}
        {status === 'error' && errorMsg}
      </div>
    </section>
  );
}
