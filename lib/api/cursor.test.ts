import { describe, expect, it } from "vitest";
import {
  decodeTransactionCursor,
  encodeTransactionCursor,
  parseCursorLimit,
  parseCursorParams,
} from "./cursor";

describe("lib/api/cursor", () => {
  it("round-trips a transaction cursor", () => {
    const raw = encodeTransactionCursor({
      v: 1,
      date: "2026-01-01T00:00:00.000Z",
      id: "tx-1",
      direction: "next",
    });
    expect(decodeTransactionCursor(raw)).toEqual({
      v: 1,
      date: "2026-01-01T00:00:00.000Z",
      id: "tx-1",
      direction: "next",
    });
  });

  it("rejects invalid cursor payloads", () => {
    expect(() => decodeTransactionCursor("")).toThrow(/must not be empty/);
    expect(() => decodeTransactionCursor("not-json")).toThrow(/valid base64url/);
  });

  it("parses limit with default and cap", () => {
    expect(parseCursorLimit(null)).toBe(6);
    expect(parseCursorLimit("50")).toBe(50);
    expect(parseCursorLimit("999")).toBe(100);
    expect(() => parseCursorLimit("0")).toThrow(/limit must be an integer/);
  });

  it("parses search params", () => {
    const encoded = encodeTransactionCursor({
      v: 1,
      date: "2026-01-02T00:00:00.000Z",
      id: "abc",
      direction: "prev",
    });
    const params = new URLSearchParams({ cursor: encoded, limit: "10" });
    const parsed = parseCursorParams(params);
    expect(parsed.limit).toBe(10);
    expect(parsed.cursor?.id).toBe("abc");
  });
});
