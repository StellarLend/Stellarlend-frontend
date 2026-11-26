// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { rpc, xdr } from "@stellar/stellar-sdk";

const mockState = vi.hoisted(() => ({
  constructor: vi.fn(),
  simulateTransaction: vi.fn(),
  scValToNative: vi.fn(),
}));

vi.mock("@stellar/stellar-sdk", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@stellar/stellar-sdk")>();
  class MockServer {
    readonly serverURL: URL;

    constructor(url: string, options?: { allowHttp?: boolean }) {
      mockState.constructor(url, options);
      this.serverURL = new URL(url);
    }

    simulateTransaction(...args: unknown[]) {
      return mockState.simulateTransaction(...args);
    }
  }

  return {
    ...actual,
    rpc: {
      ...actual.rpc,
      Server: MockServer,
    },
    scValToNative: mockState.scValToNative,
  };
});
import {
  getNetworkPassphrase,
  getSorobanRpcUrl,
  simulateContractRead,
} from "./soroban";

const CONTRACT_ID = "CC4A6A46O2KQA7KEMOFK3TQ4YRSLCJ4ZP26SQWXIKNF4DTEX3BOL2HF6";

describe("lib/soroban", () => {
  beforeEach(() => {
    mockState.constructor.mockClear();
    mockState.simulateTransaction.mockReset();
    mockState.scValToNative.mockReset();
    mockState.scValToNative.mockReturnValue(42);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("uses PUBLIC passphrase on mainnet", () => {
    vi.stubEnv("NEXT_PUBLIC_STELLAR_NETWORK", "mainnet");
    expect(getNetworkPassphrase()).toBe(
      "Public Global Stellar Network ; September 2015",
    );
  });

  it("uses PUBLIC passphrase for public", () => {
    vi.stubEnv("NEXT_PUBLIC_STELLAR_NETWORK", "public");
    expect(getNetworkPassphrase()).toBe(
      "Public Global Stellar Network ; September 2015",
    );
  });

  it("uses TESTNET passphrase for testnet and other networks", () => {
    vi.stubEnv("NEXT_PUBLIC_STELLAR_NETWORK", "testnet");
    expect(getNetworkPassphrase()).toBe(
      "Test SDF Network ; September 2015",
    );
    vi.stubEnv("NEXT_PUBLIC_STELLAR_NETWORK", "futurenet");
    expect(getNetworkPassphrase()).toBe(
      "Test SDF Network ; September 2015",
    );
  });

  it("uses the RPC URL environment and disables allowHttp for HTTPS", async () => {
    vi.stubEnv(
      "NEXT_PUBLIC_SOROBAN_RPC_URL",
      "https://rpc.example.org",
    );
    expect(getSorobanRpcUrl()).toBe("https://rpc.example.org");

    mockState.simulateTransaction.mockResolvedValue({
      _parsed: true,
      latestLedger: 123,
      result: {
        auth: [],
        retval: xdr.ScVal.scvU32(42),
      },
    } as unknown as rpc.Api.SimulateTransactionResponse);

    await simulateContractRead(CONTRACT_ID, "get_value", []);

    expect(mockState.constructor).toHaveBeenCalledWith(
      "https://rpc.example.org",
      { allowHttp: false },
    );
  });

  it("allows HTTP only for http RPC URLs", async () => {
    vi.stubEnv("NEXT_PUBLIC_SOROBAN_RPC_URL", "http://127.0.0.1:8000");
    mockState.simulateTransaction.mockResolvedValue({
      _parsed: true,
      latestLedger: 123,
      result: {
        auth: [],
        retval: xdr.ScVal.scvU32(42),
      },
    } as unknown as rpc.Api.SimulateTransactionResponse);

    await simulateContractRead(CONTRACT_ID, "get_value", []);

    expect(mockState.constructor).toHaveBeenCalledWith(
      "http://127.0.0.1:8000",
      { allowHttp: true },
    );
  });

  it("returns result, native and raw on simulation success", async () => {
    vi.stubEnv(
      "NEXT_PUBLIC_SOROBAN_RPC_URL",
      "https://rpc.example.org",
    );
    const scVal = xdr.ScVal.scvU32(42);
    const response = {
      _parsed: true,
      latestLedger: 456,
      result: {
        auth: [],
        retval: scVal,
      },
    } as unknown as rpc.Api.SimulateTransactionResponse;
    mockState.simulateTransaction.mockResolvedValue(response);

    const output = await simulateContractRead<number>(
      CONTRACT_ID,
      "get_value",
      [],
    );

    expect(output.result).toBe(scVal);
    expect(output.native).toBe(42);
    expect(output.raw).toBe(response);
  });

  it("returns null native when decode fails", async () => {
    vi.stubEnv(
      "NEXT_PUBLIC_SOROBAN_RPC_URL",
      "https://rpc.example.org",
    );
    mockState.scValToNative.mockImplementation(() => {
      throw new Error("unsupported ScVal");
    });
    mockState.simulateTransaction.mockResolvedValue({
      _parsed: true,
      latestLedger: 456,
      result: {
        auth: [],
        retval: xdr.ScVal.scvVoid(),
      },
    } as unknown as rpc.Api.SimulateTransactionResponse);

    const output = await simulateContractRead(CONTRACT_ID, "get_value", []);

    expect(output.native).toBeNull();
  });

  it("throws Simulation error", async () => {
    vi.stubEnv(
      "NEXT_PUBLIC_SOROBAN_RPC_URL",
      "https://rpc.example.org",
    );
    mockState.simulateTransaction.mockResolvedValue({
      _parsed: true,
      error: "HostError: Error(Contract, #2)",
    } as unknown as rpc.Api.SimulateTransactionResponse);

    await expect(
      simulateContractRead(CONTRACT_ID, "get_value", []),
    ).rejects.toThrow(
      "Simulation error for get_value: HostError: Error(Contract, #2)",
    );
  });

  it("throws Simulation error when simulation requires restore and is not a success", async () => {
    vi.stubEnv(
      "NEXT_PUBLIC_SOROBAN_RPC_URL",
      "https://rpc.example.org",
    );
    mockState.simulateTransaction.mockResolvedValue({
      _parsed: true,
      latestLedger: 456,
      restorePreamble: {
        minResourceFee: "100",
        transactionData: {},
      },
    } as unknown as rpc.Api.SimulateTransactionResponse);

    await expect(
      simulateContractRead(CONTRACT_ID, "get_value", []),
    ).rejects.toThrow("Simulation error for get_value: Simulation error");
  });
});
