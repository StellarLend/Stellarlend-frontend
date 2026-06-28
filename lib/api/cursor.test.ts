import { describe, expect, it } from "vitest";
import {
  DEFAULT_CURSOR_LIMIT,
  MAX_CURSOR_LIMIT,
  decodeTransactionCursor,
  encodeTransactionCursor,
  parseCursorLimit,
  parseCursorParams,
  type TransactionCursor,
} from "./cursor";

function encodeRawCursor(value: unknown): string {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

describe("transaction cursor encoding", () => {
  it("round-trips the cursor payload exactly while keeping the token opaque", () => {
    const cursor: TransactionCursor = {
      v: 1,
      date: "2026-06-28T10:15:30.000Z",
      id: "txn-001",
      direction: "next",
    };

    const encoded = encodeTransactionCursor(cursor);

    expect(encoded).not.toContain("{");
    expect(encoded).not.toContain("txn-001");
    expect(decodeTransactionCursor(encoded)).toEqual(cursor);
  });

  it("round-trips boundary keyset values including unicode ids and prev direction", () => {
    const cursor: TransactionCursor = {
      v: 1,
      date: "9999-12-31T23:59:59.999Z",
      id: `txn-${"x".repeat(250)}-e`,
      direction: "prev",
    };

    expect(cursor.id).toHaveLength(256);
    expect(decodeTransactionCursor(encodeTransactionCursor(cursor))).toEqual(
      cursor,
    );
  });

  it("round-trips unicode cursor ids without changing their code points", () => {
    const unicodeId = "txn-cafe-etoile-\u6771\u4eac";
    const cursor: TransactionCursor = {
      v: 1,
      date: "2026-01-01T00:00:00.000Z",
      id: unicodeId,
      direction: "next",
    };

    expect(decodeTransactionCursor(encodeTransactionCursor(cursor))).toEqual(
      cursor,
    );
  });

  it("rejects invalid payloads before encoding", () => {
    expect(() =>
      encodeTransactionCursor({
        v: 1,
        date: "2026-01-01T00:00:00.000Z",
        id: "",
        direction: "next",
      }),
    ).toThrow(/cursor id is invalid/);
  });
});

describe("transaction cursor decoding", () => {
  it("rejects an empty cursor token with a stable validation error", () => {
    expect(() => decodeTransactionCursor("")).toThrow(
      /cursor must not be empty/,
    );
  });

  it("rejects malformed base64url or truncated JSON without leaking parser details", () => {
    expect(() => decodeTransactionCursor("not-json")).toThrow(
      /cursor must be a valid base64url-encoded JSON object/,
    );

    const valid = encodeTransactionCursor({
      v: 1,
      date: "2026-01-01T00:00:00.000Z",
      id: "txn-001",
      direction: "next",
    });

    expect(() => decodeTransactionCursor(valid.slice(0, -2))).toThrow(
      /cursor must be a valid base64url-encoded JSON object/,
    );
  });

  it("rejects tampered cursor objects through explicit validation errors", () => {
    expect(() =>
      decodeTransactionCursor(
        encodeRawCursor({
          v: 1,
          date: "2026-01-01T00:00:00.000Z",
          id: "txn-001",
          direction: "sideways",
        }),
      ),
    ).toThrow(/cursor direction is invalid/);

    expect(() =>
      decodeTransactionCursor(
        encodeRawCursor({
          v: 2,
          date: "2026-01-01T00:00:00.000Z",
          id: "txn-001",
          direction: "next",
        }),
      ),
    ).toThrow(/cursor version is unsupported/);

    expect(() =>
      decodeTransactionCursor(
        encodeRawCursor({
          v: 1,
          date: "not-a-date",
          id: "txn-001",
          direction: "next",
        }),
      ),
    ).toThrow(/cursor date is invalid/);

    expect(() =>
      decodeTransactionCursor(
        encodeRawCursor({
          v: 1,
          date: "2026-01-01T00:00:00.000Z",
          id: "x".repeat(257),
          direction: "next",
        }),
      ),
    ).toThrow(/cursor id is invalid/);
  });

  it("rejects non-object JSON payloads", () => {
    expect(() => decodeTransactionCursor(encodeRawCursor(null))).toThrow(
      /cursor must be an object/,
    );
    expect(() => decodeTransactionCursor(encodeRawCursor("cursor"))).toThrow(
      /cursor must be an object/,
    );
  });
});

describe("cursor query parsing", () => {
  it("uses null cursor and the default limit when params are absent", () => {
    expect(parseCursorParams(new URLSearchParams())).toEqual({
      cursor: null,
      limit: DEFAULT_CURSOR_LIMIT,
    });
  });

  it("decodes cursor and limit from search params", () => {
    const cursor: TransactionCursor = {
      v: 1,
      date: "2026-02-03T04:05:06.000Z",
      id: "txn-002",
      direction: "prev",
    };

    expect(
      parseCursorParams(
        new URLSearchParams({
          cursor: encodeTransactionCursor(cursor),
          limit: "25",
        }),
      ),
    ).toEqual({
      cursor,
      limit: 25,
    });
  });

  it("caps large limits and rejects invalid limit values", () => {
    expect(parseCursorLimit(null)).toBe(DEFAULT_CURSOR_LIMIT);
    expect(parseCursorLimit("1")).toBe(1);
    expect(parseCursorLimit(String(MAX_CURSOR_LIMIT + 1))).toBe(
      MAX_CURSOR_LIMIT,
    );

    for (const value of ["0", "-1", "1.5", "abc", ""]) {
      expect(() => parseCursorLimit(value)).toThrow(
        new RegExp(
          `limit must be an integer between 1 and ${MAX_CURSOR_LIMIT}`,
        ),
      );
    }
  });
});
