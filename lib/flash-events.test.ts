import { Address, nativeToScVal } from "@stellar/stellar-sdk";
import { describe, expect, it } from "vitest";
import { decodeFlashEvent, deriveFeeBps } from "./flash-events";

const account = Address.fromString("GA5WUJ54Z23KILLCUOUNAKTPBVZWKMQVO4O6EQ5GHLAERIMLLHNCSKYH");
const contract = Address.fromString("CC4A6A46O2KQA7KEMOFK3TQ4YRSLCJ4ZP26SQWXIKNF4DTEX3BOL2HF6");
const timestamp = BigInt(1_700_000_000);
type FixtureSchema = Record<string, ["symbol", "u32" | "address" | "i128" | "u64"]>;
const commonSchema: FixtureSchema = {
  schema_version: ["symbol", "u32"],
  asset: ["symbol", "address"],
  amount: ["symbol", "i128"],
  timestamp: ["symbol", "u64"],
};

function fixture(eventName: string, data: Record<string, unknown>, schema: FixtureSchema = commonSchema) {
  return {
    id: `${eventName}-fixture`,
    ledger: 123,
    transactionIndex: 4,
    operationIndex: 1,
    ledgerClosedAt: "2023-11-14T22:13:20Z",
    txHash: "a".repeat(64),
    topic: [nativeToScVal(eventName, { type: "symbol" })],
    value: nativeToScVal(data, { type: schema }),
  };
}

describe("flash-loan event decoding", () => {
  it("decodes the XDR disbursement event and derives the observed fee rate", () => {
    const event = fixture(
      "FlashLoanEvent",
      {
        schema_version: 1,
        initiator: account,
        receiver: contract,
        asset: contract,
        amount: BigInt(100_000_000),
        fee: BigInt(50_000),
        timestamp,
      },
      {
        ...commonSchema,
        initiator: ["symbol", "address"],
        receiver: ["symbol", "address"],
        fee: ["symbol", "i128"],
      },
    );

    expect(decodeFlashEvent(event)).toMatchObject({
      kind: "loan",
      initiator: account.toString(),
      receiver: contract.toString(),
      asset: contract.toString(),
      amount: BigInt(100_000_000),
      fee: BigInt(50_000),
      feeBps: "5",
      ledger: 123,
      txHash: "a".repeat(64),
      timestamp: new Date(Number(timestamp) * 1000).toISOString(),
    });
  });

  it("decodes the XDR repayment event", () => {
    const event = fixture(
      "FlashLoanRepaidEvent",
      {
        schema_version: 1,
        payer: contract,
        asset: contract,
        amount: BigInt(100_050_000),
        timestamp,
      },
      {
        ...commonSchema,
        payer: ["symbol", "address"],
      },
    );

    expect(decodeFlashEvent(event)).toMatchObject({
      kind: "repayment",
      payer: contract.toString(),
      asset: contract.toString(),
      amount: BigInt(100_050_000),
    });
  });

  it("guards zero amounts and keeps fee derivation precise for large bigint values", () => {
    expect(deriveFeeBps(BigInt(0), BigInt(0))).toBeNull();
    expect(deriveFeeBps(BigInt(1), BigInt(0))).toBeNull();
    expect(deriveFeeBps(BigInt("500000000000000000000"), BigInt(10) ** BigInt(24))).toBe("5");
  });

  it("skips malformed, unknown-topic, and unsupported-schema events", () => {
    const base = fixture(
      "FlashLoanEvent",
      {
        schema_version: 1,
        initiator: account,
        receiver: contract,
        asset: contract,
        amount: BigInt(100),
        fee: BigInt(1),
        timestamp,
      },
      {
        ...commonSchema,
        initiator: ["symbol", "address"],
        receiver: ["symbol", "address"],
        fee: ["symbol", "i128"],
      },
    );
    const unknownSchema = fixture(
      "FlashLoanEvent",
      {
        schema_version: 2,
        initiator: account,
        receiver: contract,
        asset: contract,
        amount: BigInt(100),
        fee: BigInt(1),
        timestamp,
      },
      {
        ...commonSchema,
        initiator: ["symbol", "address"],
        receiver: ["symbol", "address"],
        fee: ["symbol", "i128"],
      },
    );
    const unknownTopic = {
      ...base,
      topic: [nativeToScVal("UnknownEvent", { type: "symbol" })],
    };
    const malformed = { ...base, value: nativeToScVal("not an event struct") };

    expect(decodeFlashEvent(base)).not.toBeNull();
    expect(decodeFlashEvent(unknownSchema)).toBeNull();
    expect(decodeFlashEvent(unknownTopic)).toBeNull();
    expect(decodeFlashEvent(malformed)).toBeNull();
  });
});
