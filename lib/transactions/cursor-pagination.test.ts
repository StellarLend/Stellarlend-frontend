import { describe, expect, it } from "vitest";
import { paginateTransactionsByCursor } from "./cursor-pagination";

const rows = [
  { id: "a", date: "2026-01-01T00:00:00.000Z" },
  { id: "b", date: "2026-01-02T00:00:00.000Z" },
  { id: "c", date: "2026-01-03T00:00:00.000Z" },
];

describe("paginateTransactionsByCursor", () => {
  it("returns the first page when no cursor is provided", () => {
    const page = paginateTransactionsByCursor(rows, { cursor: null, limit: 2, sortDir: "asc" });
    expect(page.transactions.map((row) => row.id)).toEqual(["a", "b"]);
    expect(page.nextCursor).toBeTruthy();
    expect(page.prevCursor).toBeNull();
  });

  it("pages forward from a next cursor", () => {
    const first = paginateTransactionsByCursor(rows, { cursor: null, limit: 2, sortDir: "asc" });
    expect(first.nextCursor).toBeTruthy();
    const second = paginateTransactionsByCursor(rows, {
      cursor: {
        v: 1,
        date: "2026-01-02T00:00:00.000Z",
        id: "b",
        direction: "next",
      },
      limit: 2,
      sortDir: "asc",
    });
    expect(second.transactions.map((row) => row.id)).toEqual(["c"]);
  });
});
