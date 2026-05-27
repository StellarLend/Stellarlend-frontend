import { GET } from "./route";
import { getUser } from "../../../lib/auth";
import { vi, describe, it, expect } from "vitest";

vi.mock("../../../lib/auth", () => ({
  getUser: vi.fn(),
}));

describe("GET /api/positions", () => {
  it("returns 401 when unauthenticated", async () => {
    vi.mocked(getUser).mockResolvedValueOnce(null as any);
    
    const response = await GET();
    const data = await response.json();
    
    expect(response.status).toBe(401);
    expect(data.error).toBe("Unauthorized");
  });

  it("returns position data when authenticated", async () => {
    vi.mocked(getUser).mockResolvedValueOnce({ name: "Guest" });
    
    const response = await GET();
    const data = await response.json();
    
    expect(response.status).toBe(200);
    expect(data.healthFactor).toBe(1.5);
    expect(data.availableBalance).toBe("$3,750.00 XLM");
  });
});
