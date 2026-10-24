import { describe, expect, it } from "vitest";
import { getPoolSnapshot, isValidContractAddress, MAX_IMPACT_SENTINEL } from "./reads";

describe("isValidContractAddress", () => {
  it("validates StrKey contract IDs (starts with C, 56 chars)", () => {
    expect(isValidContractAddress("CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA")).toBe(false);
    expect(isValidContractAddress("CA76OEIPJGDWWDA5H6BDLCL6ZJ5G5B757GGL3XWGOE2I2BQ5N2M3R4YQ")).toBe(true);
    expect(isValidContractAddress("")).toBe(false);
    expect(isValidContractAddress("GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7")).toBe(false);
  });
});

describe("getPoolSnapshot configuration and sentinel tests", () => {
  const tokenAId = "CB76OEIPJGDWWDA5H6BDLCL6ZJ5G5B757GGL3XWGOE2I2BQ5N2M3R4YQ";
  const tokenBId = "CC76OEIPJGDWWDA5H6BDLCL6ZJ5G5B757GGL3XWGOE2I2BQ5N2M3R4YQ";

  it("handles unconfigured or invalid contract ID by rejecting", async () => {
    await expect(getPoolSnapshot("", tokenAId, tokenBId)).rejects.toThrow("Invalid or unconfigured AMM contract ID.");
    await expect(getPoolSnapshot("invalid-id", tokenAId, tokenBId)).rejects.toThrow("Invalid or unconfigured AMM contract ID.");
  });

  it("defines MAX_IMPACT_SENTINEL as 4294967295 (u32::MAX)", () => {
    expect(MAX_IMPACT_SENTINEL).toBe(4294967295);
  });
});
