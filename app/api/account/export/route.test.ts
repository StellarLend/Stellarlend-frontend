import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { POST, resetThrottleRegistry } = await import("./route");

describe("GDPR DSAR account export API route", () => {
  beforeEach(() => {
    resetThrottleRegistry();
  });

  it("accepts a valid export request and returns a signed download URL", async () => {
    const request = new NextRequest("https://localhost/api/account/export", {
      method: "POST",
      headers: { authorization: "Bearer test-token" },
    });

    const response = await POST(request);

    expect(response.status).toBe(202);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.downloadUrl).toContain("https://storage.stellarlend.com/exports/");
    expect(body.expiresInSeconds).toBe(900);
  });
});
