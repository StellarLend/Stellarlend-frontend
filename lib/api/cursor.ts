export const DEFAULT_CURSOR_LIMIT = 6;
export const MAX_CURSOR_LIMIT = 100;

export type CursorDirection = "next" | "prev";

export interface TransactionCursor {
  v: 1;
  date: string;
  id: string;
  direction: CursorDirection;
}

export interface ParsedCursorParams {
  cursor: TransactionCursor | null;
  limit: number;
}

function isValidDate(value: string): boolean {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    !Number.isNaN(new Date(value).getTime())
  );
}

function encodeBase64Url(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function decodeBase64Url(value: string): string {
  return Buffer.from(value, "base64url").toString("utf8");
}

export function encodeTransactionCursor(cursor: TransactionCursor): string {
  validateCursor(cursor);
  return encodeBase64Url(JSON.stringify(cursor));
}

export function decodeTransactionCursor(rawCursor: string): TransactionCursor {
  if (!rawCursor) {
    throw new Error("cursor must not be empty");
  }

  let decoded: unknown;
  try {
    decoded = JSON.parse(decodeBase64Url(rawCursor));
  } catch {
    throw new Error("cursor must be a valid base64url-encoded JSON object");
  }

  return validateCursor(decoded);
}

export function parseCursorLimit(value: string | null): number {
  if (value === null) return DEFAULT_CURSOR_LIMIT;

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(
      `limit must be an integer between 1 and ${MAX_CURSOR_LIMIT}`,
    );
  }

  return Math.min(parsed, MAX_CURSOR_LIMIT);
}

export function parseCursorParams(
  searchParams: URLSearchParams,
): ParsedCursorParams {
  const rawCursor = searchParams.get("cursor");
  return {
    cursor: rawCursor === null ? null : decodeTransactionCursor(rawCursor),
    limit: parseCursorLimit(searchParams.get("limit")),
  };
}

function validateCursor(value: unknown): TransactionCursor {
  if (typeof value !== "object" || value === null) {
    throw new Error("cursor must be an object");
  }

  const candidate = value as Partial<TransactionCursor>;

  if (candidate.v !== 1) {
    throw new Error("cursor version is unsupported");
  }

  if (typeof candidate.date !== "string" || !isValidDate(candidate.date)) {
    throw new Error("cursor date is invalid");
  }

  if (
    typeof candidate.id !== "string" ||
    candidate.id.length === 0 ||
    candidate.id.length > 256
  ) {
    throw new Error("cursor id is invalid");
  }

  if (candidate.direction !== "next" && candidate.direction !== "prev") {
    throw new Error("cursor direction is invalid");
  }

  return {
    v: 1,
    date: candidate.date,
    id: candidate.id,
    direction: candidate.direction,
  };
}
