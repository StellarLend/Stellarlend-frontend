// @vitest-environment node

import { describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/v1/client-errors/route";

describe("/api/v1/client-errors route", () => {
  it("rejects oversize body with 413", async () => {
    const hugeMessage = "A".repeat(9000); // > 8 KB
    const req = new Request("http://localhost/api/v1/client-errors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "HugeError",
        message: hugeMessage,
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(413);
  });

  it("redacts G-address in message", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const address = "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN";

    const req = new Request("http://localhost/api/v1/client-errors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "TestLeak",
        message: `Failed account ${address}`,
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(consoleSpy).toHaveBeenCalledTimes(1);

    const logged = consoleSpy.mock.calls[0][0];
    expect(logged).not.toContain(address);
    expect(logged).toContain("GA5Z...KZVN");

    consoleSpy.mockRestore();
  });
});
