import { GET } from "./route";
import { describe, it, expect } from "vitest";

describe("GET /api/transactions", () => {
  it("paginates correctly", async () => {
    const req = new Request("http://localhost/api/transactions?page=1&pageSize=2");
    const res = await GET(req);
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.data.length).toBe(2);
    expect(json.meta.page).toBe(1);
    expect(json.meta.pageSize).toBe(2);
  });

  it("rejects invalid status", async () => {
    const req = new Request("http://localhost/api/transactions?status=FakeStatus");
    const res = await GET(req);
    const json = await res.json();
    expect(res.status).toBe(400);
    expect(json.error).toBe("Invalid parameters");
  });
});
