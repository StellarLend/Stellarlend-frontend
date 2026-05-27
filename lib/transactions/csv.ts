import { Transaction } from './repository';

const CSV_HEADERS = ['id', 'userId', 'type', 'amount', 'asset', 'status', 'timestamp', 'txHash'] as const;

/**
 * Escapes a single CSV field.
 * - Wraps in double-quotes if the value contains a comma, double-quote, newline,
 *   or starts with a formula-injection trigger character (=, +, -, @, tab, CR).
 * - Doubles any embedded double-quotes.
 */
export function escapeCsvField(value: string): string {
  const needsQuoting =
    /[,"\n\r]/.test(value) || /^[=+\-@\t\r]/.test(value);

  if (!needsQuoting) return value;

  return '"' + value.replace(/"/g, '""') + '"';
}

/**
 * Serializes an array of transactions to a CSV string with a header row.
 * Streams row-by-row to bound memory usage for large result sets.
 */
export function transactionsToCsv(transactions: Transaction[]): string {
  const rows: string[] = [CSV_HEADERS.join(',')];

  for (const tx of transactions) {
    const row = CSV_HEADERS.map((col) => {
      const raw = tx[col] ?? '';
      return escapeCsvField(String(raw));
    });
    rows.push(row.join(','));
  }

  return rows.join('\n');
}
