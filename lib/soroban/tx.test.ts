import { describe, it, expect } from "vitest";
import type { LendingData } from "@/lib/lending/types";
import {
  isTxBuildRequest,
  isTxSubmitRequest,
  getSorobanNetworkPassphrase,
  buildSorobanTransactionRpcRequest,
  buildSorobanSubmitRpcRequest,
  extractUnsignedXdr,
  extractSubmitResult,
  buildSorobanRpcError,
  buildLendingInstruction,
  type TxBuildRequest,
  type TxSubmitRequest,
  type SorobanRpcError,
  type SorobanRpcBuildResult,
  type SorobanRpcSubmitResult,
} from "./tx";

// ---------------------------------------------------------------------------
// Test Data Fixtures
// ---------------------------------------------------------------------------

const VALID_STELLAR_ACCOUNT = "GAJVRVXJFKHQMGJJAFQWVFP4LBKXFVKL45OEUOLKJKLJHFDDWFPOQXXX";
const INVALID_STELLAR_ACCOUNT = "INVALID_PUBLIC_KEY";

const validLendData: LendingData = {
  asset: "USDC",
  amount: 1000,
  interestRate: 5.5,
};

const validBorrowData: LendingData = {
  asset: "USDC",
  amount: 500,
  interestRate: 8.5,
  duration: 365,
  collateral: "XLM",
  collateralAmount: 10000,
};

const validTxBuildRequest: TxBuildRequest = {
  type: "lend",
  sourceAccount: VALID_STELLAR_ACCOUNT,
  data: validLendData,
};

// ---------------------------------------------------------------------------
// isTxBuildRequest - Type Guard Tests
// ---------------------------------------------------------------------------

describe("isTxBuildRequest", () => {
  it("accepts valid lend request", () => {
    expect(isTxBuildRequest(validTxBuildRequest)).toBe(true);
  });

  it("accepts valid borrow request", () => {
    const borrowRequest: TxBuildRequest = {
      type: "borrow",
      sourceAccount: VALID_STELLAR_ACCOUNT,
      data: validBorrowData,
    };
    expect(isTxBuildRequest(borrowRequest)).toBe(true);
  });

  it("rejects non-object values", () => {
    expect(isTxBuildRequest(null)).toBe(false);
    expect(isTxBuildRequest(undefined)).toBe(false);
    expect(isTxBuildRequest("string")).toBe(false);
    expect(isTxBuildRequest(123)).toBe(false);
    expect(isTxBuildRequest([])).toBe(false);
  });

  it("rejects invalid type field", () => {
    const invalid = { ...validTxBuildRequest, type: "repay" };
    expect(isTxBuildRequest(invalid)).toBe(false);
  });

  it("rejects missing type field", () => {
    const { type, ...rest } = validTxBuildRequest;
    expect(isTxBuildRequest(rest)).toBe(false);
  });

  it("rejects invalid sourceAccount", () => {
    const invalid = { ...validTxBuildRequest, sourceAccount: INVALID_STELLAR_ACCOUNT };
    expect(isTxBuildRequest(invalid)).toBe(false);
  });

  it("rejects missing sourceAccount", () => {
    const { sourceAccount, ...rest } = validTxBuildRequest;
    expect(isTxBuildRequest(rest)).toBe(false);
  });

  it("rejects empty sourceAccount", () => {
    const invalid = { ...validTxBuildRequest, sourceAccount: "" };
    expect(isTxBuildRequest(invalid)).toBe(false);
  });

  it("rejects non-object data field", () => {
    const invalid = { ...validTxBuildRequest, data: "not an object" };
    expect(isTxBuildRequest(invalid)).toBe(false);
  });

  it("rejects data with missing asset", () => {
    const { asset, ...dataWithoutAsset } = validLendData;
    const invalid = { ...validTxBuildRequest, data: dataWithoutAsset };
    expect(isTxBuildRequest(invalid)).toBe(false);
  });

  it("rejects data with empty asset string", () => {
    const invalid = { ...validTxBuildRequest, data: { ...validLendData, asset: "" } };
    expect(isTxBuildRequest(invalid)).toBe(false);
  });

  it("rejects data with whitespace-only asset", () => {
    const invalid = { ...validTxBuildRequest, data: { ...validLendData, asset: "   " } };
    expect(isTxBuildRequest(invalid)).toBe(false);
  });

  it("rejects data with non-number amount", () => {
    const invalid = { ...validTxBuildRequest, data: { ...validLendData, amount: "1000" as any } };
    expect(isTxBuildRequest(invalid)).toBe(false);
  });

  it("rejects data with missing amount", () => {
    const { amount, ...dataWithoutAmount } = validLendData;
    const invalid = { ...validTxBuildRequest, data: dataWithoutAmount };
    expect(isTxBuildRequest(invalid)).toBe(false);
  });

  it("rejects data with non-number interestRate", () => {
    const invalid = { ...validTxBuildRequest, data: { ...validLendData, interestRate: "5.5" as any } };
    expect(isTxBuildRequest(invalid)).toBe(false);
  });

  it("rejects data with missing interestRate", () => {
    const { interestRate, ...dataWithoutRate } = validLendData;
    const invalid = { ...validTxBuildRequest, data: dataWithoutRate };
    expect(isTxBuildRequest(invalid)).toBe(false);
  });

  it("accepts data with optional duration as number", () => {
    const withDuration = { ...validTxBuildRequest, data: { ...validLendData, duration: 30 } };
    expect(isTxBuildRequest(withDuration)).toBe(true);
  });

  it("rejects data with non-number duration when present", () => {
    const invalid = { ...validTxBuildRequest, data: { ...validLendData, duration: "30" as any } };
    expect(isTxBuildRequest(invalid)).toBe(false);
  });

  it("accepts data with optional collateral as string", () => {
    const withCollateral = { ...validTxBuildRequest, data: { ...validLendData, collateral: "XLM" } };
    expect(isTxBuildRequest(withCollateral)).toBe(true);
  });

  it("rejects data with empty collateral when present", () => {
    const invalid = { ...validTxBuildRequest, data: { ...validLendData, collateral: "" } };
    expect(isTxBuildRequest(invalid)).toBe(false);
  });

  it("accepts data with optional collateralAmount as number", () => {
    const withAmount = { ...validTxBuildRequest, data: { ...validLendData, collateralAmount: 5000 } };
    expect(isTxBuildRequest(withAmount)).toBe(true);
  });

  it("rejects data with non-number collateralAmount when present", () => {
    const invalid = { ...validTxBuildRequest, data: { ...validLendData, collateralAmount: "5000" as any } };
    expect(isTxBuildRequest(invalid)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isTxSubmitRequest - Type Guard Tests
// ---------------------------------------------------------------------------

describe("isTxSubmitRequest", () => {
  it("accepts valid submit request", () => {
    const valid: TxSubmitRequest = {
      signedEnvelopeXdr: "AAAAAgAAAACxLlAA...",
    };
    expect(isTxSubmitRequest(valid)).toBe(true);
  });

  it("rejects non-object values", () => {
    expect(isTxSubmitRequest(null)).toBe(false);
    expect(isTxSubmitRequest(undefined)).toBe(false);
    expect(isTxSubmitRequest("string")).toBe(false);
    expect(isTxSubmitRequest(123)).toBe(false);
  });

  it("rejects empty signedEnvelopeXdr", () => {
    const invalid = { signedEnvelopeXdr: "" };
    expect(isTxSubmitRequest(invalid)).toBe(false);
  });

  it("rejects whitespace-only signedEnvelopeXdr", () => {
    const invalid = { signedEnvelopeXdr: "   " };
    expect(isTxSubmitRequest(invalid)).toBe(false);
  });

  it("rejects missing signedEnvelopeXdr", () => {
    const invalid = {};
    expect(isTxSubmitRequest(invalid)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// getSorobanNetworkPassphrase
// ---------------------------------------------------------------------------

describe("getSorobanNetworkPassphrase", () => {
  it("returns public network passphrase for 'public'", () => {
    expect(getSorobanNetworkPassphrase("public")).toBe(
      "Public Global Stellar Network ; September 2015"
    );
  });

  it("returns testnet passphrase for 'testnet'", () => {
    expect(getSorobanNetworkPassphrase("testnet")).toBe(
      "Test SDF Network ; September 2015"
    );
  });

  it("returns testnet passphrase for any other value", () => {
    expect(getSorobanNetworkPassphrase("futurenet")).toBe(
      "Test SDF Network ; September 2015"
    );
    expect(getSorobanNetworkPassphrase("")).toBe(
      "Test SDF Network ; September 2015"
    );
    expect(getSorobanNetworkPassphrase("custom")).toBe(
      "Test SDF Network ; September 2015"
    );
  });

  it("produces deterministic output for same input", () => {
    const result1 = getSorobanNetworkPassphrase("public");
    const result2 = getSorobanNetworkPassphrase("public");
    expect(result1).toBe(result2);
  });
});

// ---------------------------------------------------------------------------
// buildLendingInstruction
// ---------------------------------------------------------------------------

describe("buildLendingInstruction", () => {
  const contractId = "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4";

  it("builds lend instruction with required fields only", () => {
    const instruction = buildLendingInstruction("lend", validLendData, contractId);

    expect(instruction).toEqual({
      type: "invoke_host_function",
      function: "lend",
      contract_id: contractId,
      args: [
        { type: "string", value: "USDC" },
        { type: "u64", value: "1000" },
        { type: "string", value: "5.5" },
      ],
      footprint: {
        read_only: [],
        read_write: [],
      },
    });
  });

  it("builds borrow instruction with all fields", () => {
    const instruction = buildLendingInstruction("borrow", validBorrowData, contractId);

    expect(instruction).toEqual({
      type: "invoke_host_function",
      function: "borrow",
      contract_id: contractId,
      args: [
        { type: "string", value: "USDC" },
        { type: "u64", value: "500" },
        { type: "string", value: "8.5" },
        { type: "u32", value: "365" },
        { type: "string", value: "XLM" },
        { type: "u64", value: "10000" },
      ],
      footprint: {
        read_only: [],
        read_write: [],
      },
    });
  });

  it("converts amount to string in u64 format", () => {
    const data = { ...validLendData, amount: 999999999 };
    const instruction = buildLendingInstruction("lend", data, contractId);
    const amountArg = instruction.args[1] as Record<string, unknown>;
    expect(amountArg.value).toBe("999999999");
  });

  it("converts interestRate to string format", () => {
    const data = { ...validLendData, interestRate: 12.75 };
    const instruction = buildLendingInstruction("lend", data, contractId);
    const rateArg = instruction.args[2] as Record<string, unknown>;
    expect(rateArg.value).toBe("12.75");
  });

  it("handles missing optional fields in borrow with defaults", () => {
    const dataWithoutOptionals = {
      asset: "XLM",
      amount: 100,
      interestRate: 6,
    };
    const instruction = buildLendingInstruction("borrow", dataWithoutOptionals, contractId);
    const args = instruction.args as Array<Record<string, unknown>>;

    expect(args[3]).toEqual({ type: "u32", value: "0" });
    expect(args[4]).toEqual({ type: "string", value: "" });
    expect(args[5]).toEqual({ type: "u64", value: "0" });
  });

  it("produces deterministic output for identical inputs", () => {
    const instruction1 = buildLendingInstruction("lend", validLendData, contractId);
    const instruction2 = buildLendingInstruction("lend", validLendData, contractId);
    expect(instruction1).toEqual(instruction2);
  });

  it("includes correct contract_id", () => {
    const customContractId = "CBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB4";
    const instruction = buildLendingInstruction("lend", validLendData, customContractId);
    expect(instruction.contract_id).toBe(customContractId);
  });

  it("always includes empty footprint arrays", () => {
    const instruction = buildLendingInstruction("lend", validLendData, contractId);
    expect(instruction.footprint).toEqual({
      read_only: [],
      read_write: [],
    });
  });
});

// ---------------------------------------------------------------------------
// buildSorobanTransactionRpcRequest
// ---------------------------------------------------------------------------

describe("buildSorobanTransactionRpcRequest", () => {
  const contractId = "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4";

  it("builds valid RPC request for lend operation", () => {
    const request = buildSorobanTransactionRpcRequest(
      validTxBuildRequest,
      contractId,
      "testnet"
    );

    expect(request).toEqual({
      jsonrpc: "2.0",
      id: "build_soroban_transaction",
      method: "build_soroban_transaction",
      params: [
        {
          source: VALID_STELLAR_ACCOUNT,
          network_passphrase: "Test SDF Network ; September 2015",
          fee: 100,
          instructions: [
            {
              type: "invoke_host_function",
              function: "lend",
              contract_id: contractId,
              args: [
                { type: "string", value: "USDC" },
                { type: "u64", value: "1000" },
                { type: "string", value: "5.5" },
              ],
              footprint: {
                read_only: [],
                read_write: [],
              },
            },
          ],
        },
      ],
    });
  });

  it("builds valid RPC request for borrow operation", () => {
    const borrowRequest: TxBuildRequest = {
      type: "borrow",
      sourceAccount: VALID_STELLAR_ACCOUNT,
      data: validBorrowData,
    };
    const request = buildSorobanTransactionRpcRequest(borrowRequest, contractId, "testnet");

    expect(request.method).toBe("build_soroban_transaction");
    expect(request.params[0].instructions[0].function).toBe("borrow");
  });

  it("uses correct source account from request", () => {
    const request = buildSorobanTransactionRpcRequest(
      validTxBuildRequest,
      contractId,
      "testnet"
    );
    expect(request.params[0].source).toBe(VALID_STELLAR_ACCOUNT);
  });

  it("uses public network passphrase for public network", () => {
    const request = buildSorobanTransactionRpcRequest(
      validTxBuildRequest,
      contractId,
      "public"
    );
    expect(request.params[0].network_passphrase).toBe(
      "Public Global Stellar Network ; September 2015"
    );
  });

  it("uses testnet passphrase for testnet", () => {
    const request = buildSorobanTransactionRpcRequest(
      validTxBuildRequest,
      contractId,
      "testnet"
    );
    expect(request.params[0].network_passphrase).toBe(
      "Test SDF Network ; September 2015"
    );
  });

  it("includes fixed fee of 100", () => {
    const request = buildSorobanTransactionRpcRequest(
      validTxBuildRequest,
      contractId,
      "testnet"
    );
    expect(request.params[0].fee).toBe(100);
  });

  it("includes correct jsonrpc version", () => {
    const request = buildSorobanTransactionRpcRequest(
      validTxBuildRequest,
      contractId,
      "testnet"
    );
    expect(request.jsonrpc).toBe("2.0");
  });

  it("includes correct id", () => {
    const request = buildSorobanTransactionRpcRequest(
      validTxBuildRequest,
      contractId,
      "testnet"
    );
    expect(request.id).toBe("build_soroban_transaction");
  });

  it("produces deterministic output for same inputs", () => {
    const request1 = buildSorobanTransactionRpcRequest(
      validTxBuildRequest,
      contractId,
      "testnet"
    );
    const request2 = buildSorobanTransactionRpcRequest(
      validTxBuildRequest,
      contractId,
      "testnet"
    );
    expect(request1).toEqual(request2);
  });

  it("includes instruction array with single element", () => {
    const request = buildSorobanTransactionRpcRequest(
      validTxBuildRequest,
      contractId,
      "testnet"
    );
    expect(request.params[0].instructions).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// buildSorobanSubmitRpcRequest
// ---------------------------------------------------------------------------

describe("buildSorobanSubmitRpcRequest", () => {
  const signedXdr = "AAAAAgAAAACxLlAA...SIGNED_ENVELOPE";

  it("builds valid RPC submit request", () => {
    const request = buildSorobanSubmitRpcRequest(signedXdr);

    expect(request).toEqual({
      jsonrpc: "2.0",
      id: "send_transaction",
      method: "send_transaction",
      params: [{ tx: signedXdr }],
    });
  });

  it("includes correct jsonrpc version", () => {
    const request = buildSorobanSubmitRpcRequest(signedXdr);
    expect(request.jsonrpc).toBe("2.0");
  });

  it("includes correct id", () => {
    const request = buildSorobanSubmitRpcRequest(signedXdr);
    expect(request.id).toBe("send_transaction");
  });

  it("includes correct method", () => {
    const request = buildSorobanSubmitRpcRequest(signedXdr);
    expect(request.method).toBe("send_transaction");
  });

  it("wraps signedEnvelopeXdr in tx param", () => {
    const request = buildSorobanSubmitRpcRequest(signedXdr);
    expect(request.params[0].tx).toBe(signedXdr);
  });

  it("produces deterministic output for same input", () => {
    const request1 = buildSorobanSubmitRpcRequest(signedXdr);
    const request2 = buildSorobanSubmitRpcRequest(signedXdr);
    expect(request1).toEqual(request2);
  });
});

// ---------------------------------------------------------------------------
// extractUnsignedXdr
// ---------------------------------------------------------------------------

describe("extractUnsignedXdr", () => {
  it("extracts transaction field when present", () => {
    const response: SorobanRpcBuildResult = {
      transaction: "AAAAAgAAAACxLlAA...",
    };
    expect(extractUnsignedXdr(response)).toBe("AAAAAgAAAACxLlAA...");
  });

  it("extracts transaction_xdr field when transaction is missing", () => {
    const response: SorobanRpcBuildResult = {
      transaction_xdr: "AAAAAgAAAACxLlBB...",
    };
    expect(extractUnsignedXdr(response)).toBe("AAAAAgAAAACxLlBB...");
  });

  it("prefers transaction over transaction_xdr when both present", () => {
    const response: SorobanRpcBuildResult = {
      transaction: "TRANSACTION_FIELD",
      transaction_xdr: "TRANSACTION_XDR_FIELD",
    };
    expect(extractUnsignedXdr(response)).toBe("TRANSACTION_FIELD");
  });

  it("returns undefined for non-object input", () => {
    expect(extractUnsignedXdr(null)).toBeUndefined();
    expect(extractUnsignedXdr(undefined)).toBeUndefined();
    expect(extractUnsignedXdr("string")).toBeUndefined();
    expect(extractUnsignedXdr(123)).toBeUndefined();
  });

  it("returns undefined when neither field is present", () => {
    const response = { other_field: "value" };
    expect(extractUnsignedXdr(response)).toBeUndefined();
  });

  it("returns undefined for empty object", () => {
    expect(extractUnsignedXdr({})).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// extractSubmitResult
// ---------------------------------------------------------------------------

describe("extractSubmitResult", () => {
  it("extracts result with hash field", () => {
    const response: SorobanRpcSubmitResult = {
      hash: "abc123def456",
      status: "PENDING",
    };
    const result = extractSubmitResult(response);
    expect(result).toEqual(response);
  });

  it("extracts result with status field only", () => {
    const response: SorobanRpcSubmitResult = {
      status: "SUCCESS",
    };
    const result = extractSubmitResult(response);
    expect(result).toEqual(response);
  });

  it("extracts result with hash field only", () => {
    const response: SorobanRpcSubmitResult = {
      hash: "xyz789",
    };
    const result = extractSubmitResult(response);
    expect(result).toEqual(response);
  });

  it("preserves additional fields in result", () => {
    const response: SorobanRpcSubmitResult = {
      hash: "abc123",
      status: "SUCCESS",
      ledger: 12345,
      extra: "data",
    };
    const result = extractSubmitResult(response);
    expect(result).toEqual(response);
  });

  it("returns undefined for non-object input", () => {
    expect(extractSubmitResult(null)).toBeUndefined();
    expect(extractSubmitResult(undefined)).toBeUndefined();
    expect(extractSubmitResult("string")).toBeUndefined();
    expect(extractSubmitResult(123)).toBeUndefined();
  });

  it("returns undefined when neither hash nor status present", () => {
    const response = { other_field: "value" };
    expect(extractSubmitResult(response)).toBeUndefined();
  });

  it("returns undefined for empty object", () => {
    expect(extractSubmitResult({})).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// buildSorobanRpcError
// ---------------------------------------------------------------------------

describe("buildSorobanRpcError", () => {
  it("builds error from valid error object with all fields", () => {
    const error = {
      code: 404,
      message: "Transaction not found",
      data: { details: "Additional info" },
    };
    const result = buildSorobanRpcError(error);

    expect(result).toEqual({
      code: 404,
      message: "Transaction not found",
      data: { details: "Additional info" },
    });
  });

  it("builds error from object with string code", () => {
    const error = {
      code: "TX_NOT_FOUND",
      message: "Transaction not found",
    };
    const result = buildSorobanRpcError(error);

    expect(result.code).toBe("TX_NOT_FOUND");
    expect(result.message).toBe("Transaction not found");
  });

  it("uses UNKNOWN_ERROR code when code is missing", () => {
    const error = {
      message: "Something went wrong",
    };
    const result = buildSorobanRpcError(error);

    expect(result.code).toBe("UNKNOWN_ERROR");
    expect(result.message).toBe("Something went wrong");
  });

  it("uses default message when message is missing", () => {
    const error = {
      code: 500,
    };
    const result = buildSorobanRpcError(error);

    expect(result.code).toBe(500);
    expect(result.message).toBe("Unknown Soroban RPC error");
  });

  it("uses default message when message is not a string", () => {
    const error = {
      code: 400,
      message: { nested: "object" },
    };
    const result = buildSorobanRpcError(error);

    expect(result.message).toBe("Unknown Soroban RPC error");
  });

  it("handles non-object error by converting to string", () => {
    const result1 = buildSorobanRpcError("Simple error string");
    expect(result1).toEqual({
      code: "UNKNOWN_ERROR",
      message: "Simple error string",
      data: undefined,
    });

    const result2 = buildSorobanRpcError(42);
    expect(result2).toEqual({
      code: "UNKNOWN_ERROR",
      message: "42",
      data: undefined,
    });
  });

  it("handles null error", () => {
    const result = buildSorobanRpcError(null);
    expect(result).toEqual({
      code: "UNKNOWN_ERROR",
      message: "null",
      data: undefined,
    });
  });

  it("handles undefined error", () => {
    const result = buildSorobanRpcError(undefined);
    expect(result).toEqual({
      code: "UNKNOWN_ERROR",
      message: "undefined",
      data: undefined,
    });
  });

  it("preserves data field when present", () => {
    const error = {
      code: 500,
      message: "Server error",
      data: { trace: "stack trace here" },
    };
    const result = buildSorobanRpcError(error);
    expect(result.data).toEqual({ trace: "stack trace here" });
  });

  it("sets data to undefined when not present", () => {
    const error = {
      code: 400,
      message: "Bad request",
    };
    const result = buildSorobanRpcError(error);
    expect(result.data).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Edge Cases and Integration Tests
// ---------------------------------------------------------------------------

describe("Edge Cases", () => {
  it("handles zero amount in lending data", () => {
    const zeroAmount = { ...validLendData, amount: 0 };
    const instruction = buildLendingInstruction("lend", zeroAmount, "CONTRACT_ID");
    const amountArg = instruction.args[1] as Record<string, unknown>;
    expect(amountArg.value).toBe("0");
  });

  it("handles zero interest rate", () => {
    const zeroRate = { ...validLendData, interestRate: 0 };
    const instruction = buildLendingInstruction("lend", zeroRate, "CONTRACT_ID");
    const rateArg = instruction.args[2] as Record<string, unknown>;
    expect(rateArg.value).toBe("0");
  });

  it("handles negative numbers converted to strings", () => {
    const negativeAmount = { ...validLendData, amount: -100 };
    const instruction = buildLendingInstruction("lend", negativeAmount, "CONTRACT_ID");
    const amountArg = instruction.args[1] as Record<string, unknown>;
    expect(amountArg.value).toBe("-100");
  });

  it("handles very large numbers", () => {
    const largeAmount = { ...validLendData, amount: 999999999999999 };
    const instruction = buildLendingInstruction("lend", largeAmount, "CONTRACT_ID");
    const amountArg = instruction.args[1] as Record<string, unknown>;
    expect(amountArg.value).toBe("999999999999999");
  });

  it("handles decimal precision in interest rate", () => {
    const preciseRate = { ...validLendData, interestRate: 5.123456789 };
    const instruction = buildLendingInstruction("lend", preciseRate, "CONTRACT_ID");
    const rateArg = instruction.args[2] as Record<string, unknown>;
    expect(rateArg.value).toBe("5.123456789");
  });

  it("handles special characters in asset name", () => {
    const specialAsset = { ...validLendData, asset: "USD-C" };
    const instruction = buildLendingInstruction("lend", specialAsset, "CONTRACT_ID");
    const assetArg = instruction.args[0] as Record<string, unknown>;
    expect(assetArg.value).toBe("USD-C");
  });
});

describe("Deterministic Output Tests", () => {
  const contractId = "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4";

  it("produces identical RPC requests for identical inputs", () => {
    const requests = Array.from({ length: 5 }, () =>
      buildSorobanTransactionRpcRequest(validTxBuildRequest, contractId, "testnet")
    );

    requests.forEach((request) => {
      expect(request).toEqual(requests[0]);
    });
  });

  it("produces identical submit requests for identical inputs", () => {
    const xdr = "SIGNED_XDR_DATA";
    const requests = Array.from({ length: 5 }, () =>
      buildSorobanSubmitRpcRequest(xdr)
    );

    requests.forEach((request) => {
      expect(request).toEqual(requests[0]);
    });
  });

  it("produces identical instructions for identical inputs", () => {
    const instructions = Array.from({ length: 5 }, () =>
      buildLendingInstruction("lend", validLendData, contractId)
    );

    instructions.forEach((instruction) => {
      expect(instruction).toEqual(instructions[0]);
    });
  });
});

describe("Type Integration Tests", () => {
  it("isTxBuildRequest accepts output compatible with buildSorobanTransactionRpcRequest", () => {
    const request: TxBuildRequest = {
      type: "lend",
      sourceAccount: VALID_STELLAR_ACCOUNT,
      data: validLendData,
    };

    expect(isTxBuildRequest(request)).toBe(true);

    // Should not throw
    const rpcRequest = buildSorobanTransactionRpcRequest(
      request,
      "CONTRACT_ID",
      "testnet"
    );
    expect(rpcRequest).toBeDefined();
  });

  it("isTxSubmitRequest accepts output compatible with buildSorobanSubmitRpcRequest", () => {
    const request: TxSubmitRequest = {
      signedEnvelopeXdr: "SIGNED_XDR",
    };

    expect(isTxSubmitRequest(request)).toBe(true);

    // Should not throw
    const rpcRequest = buildSorobanSubmitRpcRequest(request.signedEnvelopeXdr);
    expect(rpcRequest).toBeDefined();
  });
});
