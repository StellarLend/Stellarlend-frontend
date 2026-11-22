import { TOKEN_SCALE, type LendingEvent } from "@/lib/events";

export const CSV_HEADERS = [
  "timestamp",
  "kind",
  "asset",
  "amount_decimal",
  "amount_base_units",
  "tx_hash",
] as const;

export type EventsToCsvOptions = {
  asset?: string;
};

/**
 * Formats a base-unit bigint amount into a plain decimal string (7 decimal places max, no thousand separators)
 * suitable for accounting CSV exports.
 */
export function formatCsvDecimalAmount(amount: bigint): string {
  const isNegative = amount < BigInt(0);
  const abs = isNegative ? -amount : amount;
  const whole = abs / TOKEN_SCALE;
  const fraction = (abs % TOKEN_SCALE).toString().padStart(7, "0").replace(/0+$/, "");
  const sign = isNegative ? "-" : "";
  return fraction ? `${sign}${whole.toString()}.${fraction}` : `${sign}${whole.toString()}`;
}

/**
 * Neutralizes spreadsheet formula injection (CSV injection) and applies RFC-4180 escaping.
 * - Cells starting with =, +, -, @ are prefixed with a single quote (').
 * - Cells containing double quotes, commas, CR, or LF are wrapped in double quotes with internal quotes doubled.
 */
export function escapeCsvCell(raw: string): string {
  const str = String(raw);
  const safe = /^[=+\-@]/.test(str) ? `'${str}` : str;
  if (/[",\r\n]/.test(safe)) {
    return `"${safe.replace(/"/g, '""')}"`;
  }
  return safe;
}

/**
 * Converts an array of LendingEvent records into an RFC-4180 compliant CSV string.
 * Columns: ISO timestamp, kind, asset, amount (decimal), amount (base units), tx hash
 */
export function eventsToCsv(
  events: readonly LendingEvent[],
  options: EventsToCsvOptions = {}
): string {
  const defaultAsset = options.asset ?? "XLM";
  const headerLine = CSV_HEADERS.map(escapeCsvCell).join(",");
  const rows = events.map((ev) => {
    const isoTimestamp =
      ev.timestamp && ev.timestamp > 0
        ? new Date(ev.timestamp * 1000).toISOString()
        : "";
    const asset = (ev as LendingEvent & { asset?: string }).asset ?? defaultAsset;
    const decimalAmount = formatCsvDecimalAmount(ev.amount);
    const baseUnits = ev.amount.toString();
    const cells = [
      isoTimestamp,
      ev.kind,
      asset,
      decimalAmount,
      baseUnits,
      ev.txHash,
    ];
    return cells.map(escapeCsvCell).join(",");
  });

  return [headerLine, ...rows].join("\r\n");
}

/**
 * Builds the recommended export filename:
 * stellarlend-history-<short address>-<YYYY-MM-DD>.csv
 */
export function buildHistoryCsvFilename(
  address?: string | null,
  now: Date = new Date()
): string {
  const trimmed = address?.trim() ?? "";
  const shortAddr =
    trimmed.length > 8
      ? `${trimmed.slice(0, 4)}-${trimmed.slice(-4)}`.toLowerCase()
      : (trimmed || "wallet").toLowerCase();
  const datePart = now.toISOString().slice(0, 10);
  return `stellarlend-history-${shortAddr}-${datePart}.csv`;
}

/**
 * Triggers a browser download of the CSV content as a Blob.
 */
export function downloadHistoryCsv(
  events: readonly LendingEvent[],
  address?: string | null,
  options: EventsToCsvOptions & { now?: Date } = {}
): string {
  const csv = eventsToCsv(events, options);
  const filename = buildHistoryCsvFilename(address, options.now);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });

  if (typeof URL !== "undefined" && typeof URL.createObjectURL === "function" && typeof document !== "undefined") {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", filename);
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    if (typeof URL.revokeObjectURL === "function") {
      URL.revokeObjectURL(url);
    }
  }

  return filename;
}
