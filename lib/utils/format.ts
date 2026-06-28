import { cn } from "./cn";

export function formatCurrency(value: number, precision: number = 2, currency?: string): string {
  if (isNaN(value)) return '';
  const parts = value.toFixed(precision).split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const formatted = parts.join('.');
  return currency ? `${formatted} ${currency}` : formatted;
}
