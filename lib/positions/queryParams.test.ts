import { describe, expect, it } from "vitest";

import { walletAddressSchema } from "./queryParams";

const VALID_ACCOUNT_ID =
  "GC55ABBICTDLKRSM3QWUFG4FBRDEQBK56632PLM46N2BVQFQKTUM3KMP";
const CHECKSUM_INVALID_ACCOUNT_ID =
  "GC55ABBICTDLKRSM3QWUFG4FBRDEQBK56632PLM46N2BVQFQKTUM3KMA";
const OVERLONG_ACCOUNT_ID = `G${"A".repeat(56)}`;

function messagesFor(value: unknown) {
  const result = walletAddressSchema.safeParse(value);

  expect(result.success).toBe(false);

  return result.success
    ? []
    : result.error.issues.map((issue) => issue.message);
}

describe("walletAddressSchema", () => {
  it("accepts a well-formed Stellar account ID", () => {
    const result = walletAddressSchema.safeParse(VALID_ACCOUNT_ID);

    expect(result.success).toBe(true);
    expect(result.success ? result.data : undefined).toBe(VALID_ACCOUNT_ID);
  });

  it("rejects an empty wallet address with the required message", () => {
    expect(messagesFor("")).toContain("Wallet address is required");
  });

  it("rejects non-string input with the Zod type message", () => {
    expect(messagesFor(123)).toContain(
      "Invalid input: expected string, received number",
    );
  });

  it("rejects account IDs over 56 characters with the length message", () => {
    expect(OVERLONG_ACCOUNT_ID).toHaveLength(57);
    expect(messagesFor(OVERLONG_ACCOUNT_ID)).toContain(
      "Wallet address is too long",
    );
  });

  it("rejects a correctly sized account ID with an invalid checksum", () => {
    expect(CHECKSUM_INVALID_ACCOUNT_ID).toHaveLength(56);
    expect(messagesFor(CHECKSUM_INVALID_ACCOUNT_ID)).toEqual([
      "Invalid Stellar account address",
    ]);
  });
});
