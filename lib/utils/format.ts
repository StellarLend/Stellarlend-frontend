export function formatCurrency(value: number, precision: number = 2): string {
  if (isNaN(value)) return '';
  const parts = value.toFixed(precision).split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const formatted = parts.join('.');
  return currency ? `${formatted} ${currency}` : formatted;
}

export function formatPercentage(value: number, precision: number = 1): string {
  if (isNaN(value)) return '0%';
  const sign = value > 0 ? '+' : value < 0 ? '-' : '';
  const absValue = Math.abs(value);
  return `${sign}${absValue.toFixed(precision)}%`;
}
