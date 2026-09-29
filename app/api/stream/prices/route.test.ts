import { describe, it, expect, vi, afterEach } from "vitest";
import { GET } from "./route";

describe("GET /api/stream/prices", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

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

  it("runs clearInterval exactly once when the SSE stream is cancelled", async () => {
    const clearIntervalSpy = vi.spyOn(globalThis, "clearInterval");

    const res = await GET();
    const reader = res.body!.getReader();

    await reader.read();
    await reader.cancel();

    expect(clearIntervalSpy).toHaveBeenCalledTimes(1);
  });
});