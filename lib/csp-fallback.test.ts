import { describe, expect, it } from "vitest";
import { buildCsp } from "./csp";

function connectSrc(csp: string): string[] {
  const directive = csp.split(";").map((d) => d.trim()).find((d) => d.startsWith("connect-src "));
  return directive ? directive.split(/\s+/).slice(1) : [];
}

describe("buildCsp fallback RPC origins", () => {
  const base = {
    nonce: "abc123",
    horizon: "https://horizon-testnet.stellar.org",
    rpc: "https://soroban-testnet.stellar.org",
  };

  it("lists the primary and every fallback origin in connect-src", () => {
    const csp = buildCsp({
      ...base,
      rpcFallbacks: ["https://rpc-b.example.com/soroban", "https://rpc-c.example.com:8443"],
    });
    expect(connectSrc(csp)).toEqual([
      "'self'",
      "https://horizon-testnet.stellar.org",
      "https://soroban-testnet.stellar.org",
      "https://rpc-b.example.com",
      "https://rpc-c.example.com:8443",
    ]);
  });

  it("is unchanged when no fallbacks are configured", () => {
    expect(buildCsp(base)).toBe(buildCsp({ ...base, rpcFallbacks: [] }));
  });

  it("de-duplicates a fallback that shares an origin with the primary", () => {
    const origins = connectSrc(buildCsp({ ...base, rpcFallbacks: ["https://soroban-testnet.stellar.org/other"] }));
    expect(origins.filter((o) => o === "https://soroban-testnet.stellar.org")).toHaveLength(1);
  });

  it("rejects a non-https fallback in production instead of silently widening the policy", () => {
    expect(() => buildCsp({ ...base, rpcFallbacks: ["http://rpc-b.example.com"] })).toThrow(/Non-HTTPS/);
  });
});
