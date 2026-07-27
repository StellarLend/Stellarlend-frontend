import { GET } from "./route";
import { getUser } from "../../../lib/auth";
import { vi, describe, it, expect } from "vitest";
import { indexAccountTransactions } from "@/lib/indexer";
import { NextRequest } from "next/server";

vi.mock("../../../lib/auth", () => ({
  getUser: vi.fn(),
}));

vi.mock("@/lib/indexer", () => ({
  indexAccountTransactions: vi.fn(),
}));

describe("GET /api/positions", () => {
  it("returns 401 when unauthenticated", async () => {
    vi.mocked(getUser).mockResolvedValueOnce(null as any);
    
    const req = new NextRequest("http://localhost/api/positions");
    const response = await GET(req);
    const data = await response.json();
    
    expect(response.status).toBe(401);
    expect(data.error).toBe("Unauthorized");
  });

  it("returns position data when authenticated", async () => {
    vi.mocked(getUser).mockResolvedValueOnce({ id: "user-123", name: "Guest" });
    vi.mocked(indexAccountTransactions).mockResolvedValueOnce([
      { id: '1', type: 'Deposit', amount: 500, asset: 'XLM', date: '2023-01-01', time: '12:00', status: 'Completed' }
    ]);
    
    const req = new NextRequest("http://localhost/api/positions");
    const response = await GET(req);
    const data = await response.json();
    
    expect(response.status).toBe(200);
    expect(data.healthFactor).toBe(1.5);
    expect(data.availableBalance).toBe("$500.00 XLM");
  });

  it("asserts two different userIds receive different position data", async () => {
    // User A
    vi.mocked(getUser).mockResolvedValueOnce({ id: "user-abc" });
    vi.mocked(indexAccountTransactions).mockResolvedValueOnce([
      { id: '1', type: 'Deposit', amount: 1000, asset: 'XLM', date: '2023-01-01', time: '12:00', status: 'Completed' }
    ]);
    
    const req1 = new NextRequest("http://localhost/api/positions");
    const response1 = await GET(req1);
    const data1 = await response1.json();
    
    // User B
    vi.mocked(getUser).mockResolvedValueOnce({ id: "user-xyz" });
    vi.mocked(indexAccountTransactions).mockResolvedValueOnce([
      { id: '2', type: 'Deposit', amount: 2000, asset: 'XLM', date: '2023-01-01', time: '12:00', status: 'Completed' }
    ]);
    
    const req2 = new NextRequest("http://localhost/api/positions");
    const response2 = await GET(req2);
    const data2 = await response2.json();
    
    expect(data1.availableBalance).toBe("$1,000.00 XLM");
    expect(data2.availableBalance).toBe("$2,000.00 XLM");
    expect(data1.availableBalance).not.toBe(data2.availableBalance);
  });
});
