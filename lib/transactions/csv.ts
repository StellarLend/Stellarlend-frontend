import type { Transaction } from './types';

const CSV_HEADERS = ['ID', 'Type', 'Amount', 'Asset', 'Date', 'Time', 'Status'] as const;

/**
 * Escapes a single CSV field value.
 *
 * - Wraps all fields in double-quotes.
 * - Doubles any embedded double-quotes per RFC 4180.
 * - Prefixes fields starting with =, +, -, or @ with a single quote to
 *   prevent formula-injection when opened in spreadsheet applications.
 */
export function escapeField(value: string): string {
  const injection = /^[=+\-@\t\r]/.test(value);
  const escaped = (injection ? `'${value}` : value).replace(/"/g, '""');
  return `"${escaped}"`;
}

export function serializeTransactionsToCSV(transactions: Transaction[]): string {
  const header = CSV_HEADERS.map(escapeField).join(',');

  const rows = transactions.map((txn) =>
    [
      txn.id,
      txn.type,
      txn.amount.toString(),
      txn.asset,
      txn.date,
      txn.time,
      txn.status,
    ]
      .map(escapeField)
      .join(','),
  );

  return [header, ...rows].join('\r\n');
}

export function escapeCsvField(value: string): string {
  const needsQuotes = /[,="\n\r]/.test(value) || /^[=+\-@]/.test(value);
  if (!needsQuotes) return value;
  const escaped = value.replace(/"/g, '""');
  return `"${escaped}"`;
}

export function transactionsToCsv(transactions: any[]): string {
  const header = 'id,userId,type,amount,asset,status,timestamp,txHash';
  const rows = transactions.map((t) => {
    return [
      t.id,
      t.userId,
      t.type,
      t.amount?.toString() ?? '',
      t.asset ?? '',
      t.status,
      t.timestamp ?? '',
      t.txHash ?? '',
    ]
      .map((val) => escapeCsvField(val))
      .join(',');
  });
  return [header, ...rows].join('\n');
}

