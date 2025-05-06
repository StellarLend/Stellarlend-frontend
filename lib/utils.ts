import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const formatDateTime = (date: string, time: string) => {
  let fixedTime = time.replace(/(AM|PM)$/i, ' $1');
  const d = new Date(date + ' ' + fixedTime);
  const options: Intl.DateTimeFormatOptions = { month: 'short', day: '2-digit', year: 'numeric' };
  const dateStr = d.toLocaleDateString('en-US', options);
  let [h, m] = [d.getHours(), d.getMinutes()];
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12;
  h = h ? h : 12;
  const timeStr = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}${ampm}`;

  return { date: dateStr, time: timeStr }
};