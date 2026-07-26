import { describe, it, expect } from "vitest";
import { GET } from "./route";

describe("GET /api/stream/prices", () => {
  it("returns a text/event-stream response", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const ct = res.headers.get("Content-Type");
    expect(ct).toMatch(/text\/event-stream/i);
  });

  it("returns proper cache headers", async () => {
    const res = await GET();
    expect(res.headers.get("Cache-Control")).toBe("no-cache");
    expect(res.headers.get("Connection")).toBe("keep-alive");
  });

  it("returns a ReadableStream", async () => {
    const res = await GET();
    const body = res.body;
    expect(body).toBeDefined();
  });
});