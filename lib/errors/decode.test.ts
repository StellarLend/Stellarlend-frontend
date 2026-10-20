import { describe, expect, it } from "vitest";
import { decodeContractError } from "./decode";
import { LENDING_ERRORS } from "./lending-errors";

describe("decodeContractError", () => {
  it("decodes a Soroban contract error code", () => {
    const result = decodeContractError({ error: "simulation failed: Error(Contract, #2007)" });
    expect(result).toMatchObject({
      code: 2007,
      name: "InsufficientCollateral",
      message: LENDING_ERRORS[2007].message,
      hint: LENDING_ERRORS[2007].hint,
    });
  });

  it.each([
    ["OperationPaused", "OperationPaused"],
    ["OperationDisabledDuringShutdown", "OperationDisabledDuringShutdown"],
    ["ActionBlockedInRecovery", "ActionBlockedInRecovery"],
    ["InsufficientLiquidity", "InsufficientLiquidity"],
    ["FlashLoanUtilizationExceeded", "FlashLoanUtilizationExceeded"],
    ["InsufficientRepayment", "InsufficientRepayment"],
  ])("decodes contract panic %s", (panic, name) => {
    const result = decodeContractError({ diagnosticEvents: [`HostError: contract panicked: ${panic}`] });
    expect(result.name).toBe(name);
    expect(result.message.length).toBeGreaterThan(0);
    expect(result.message.length).toBeLessThan(120);
    expect(result.hint).toBeTruthy();
  });

  it("decodes panic names from XDR-like base64 diagnostics", () => {
    const payload = btoa("HostError OperationPaused");
    expect(decodeContractError({ diagnostic_events: [{ event: payload }] }).name).toBe("OperationPaused");
  });

  it("recognizes Freighter user rejection", () => {
    expect(decodeContractError(new Error("User declined access")).name).toBe("UserRejected");
  });

  it("recognizes failed fetches and RPC server errors", () => {
    expect(decodeContractError(new TypeError("Failed to fetch")).name).toBe("NetworkError");
    expect(decodeContractError({ response: { status: 503, data: "upstream failure" } }).name).toBe("NetworkError");
  });

  it("does not expose server diagnostics or stack traces in the user message", () => {
    const result = decodeContractError({
      response: { status: 503, url: "https://private-rpc.example", data: "secret backend detail" },
    });
    expect(result.message).not.toContain("private-rpc");
    expect(result.message).not.toContain("secret backend");
  });

  it.each([undefined, "garbage input", new Error("ordinary failure"), { data: { xdr: "0xdeadbeef" } }])(
    "returns a safe fallback for unknown input",
    (value) => {
      expect(() => decodeContractError(value)).not.toThrow();
      expect(decodeContractError(value)).toMatchObject({ name: "UnknownError" });
    },
  );

  it("keeps every catalogue code unique", () => {
    const codes = Object.keys(LENDING_ERRORS);
    expect(new Set(codes).size).toBe(codes.length);
    expect(codes).toHaveLength(61);
    for (const entry of Object.values(LENDING_ERRORS)) {
      expect(entry.message.length).toBeLessThan(120);
      expect(entry.hint.length).toBeLessThan(120);
    }
  });
});
