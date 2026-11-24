import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { toBaseUnits, fromBaseUnits, MAX_I128 } from "./amount";
import { parseAmount } from "./demo-ledger";

describe("toBaseUnits", () => {
  it("converts whole and fractional XLM exactly", () => {
    expect(toBaseUnits("1")).toEqual({ ok: true, value: 10_000_000n });
    expect(toBaseUnits("1.5")).toEqual({ ok: true, value: 15_000_000n });
    expect(toBaseUnits("0.0000001")).toEqual({ ok: true, value: 1n });
    expect(toBaseUnits("0")).toEqual({ ok: true, value: 0n });
    expect(toBaseUnits("123456789.1234567")).toEqual({
      ok: true,
      value: 1_234_567_891_234_567n,
    });
  });

  it("avoids floating point drift", () => {
    expect(toBaseUnits("0.1")).toEqual({ ok: true, value: 1_000_000n });
    expect(toBaseUnits("0.3")).toEqual({ ok: true, value: 3_000_000n });
    expect(toBaseUnits("0.1").ok && toBaseUnits("0.2").ok).toBe(true);
  });

  it.each([
    ["", "empty"],
    [".", "empty"],
    ["1.", "invalid-format"],
    ["+1", "invalid-format"],
    ["1e3", "invalid-format"],
    ["0x10", "invalid-format"],
    [" 1", "invalid-format"],
    ["1 ", "invalid-format"],
    ["1,5", "invalid-format"],
    ["-1", "negative"],
    ["-0.5", "negative"],
    ["1.12345678", "too-many-decimals"],
  ])("rejects %j as %s", (input, error) => {
    expect(toBaseUnits(input)).toEqual({ ok: false, error });
  });

  it("enforces the contract's i128 range", () => {
    expect(toBaseUnits(fromBaseUnits(MAX_I128))).toEqual({ ok: true, value: MAX_I128 });
    expect(toBaseUnits(fromBaseUnits(MAX_I128 + 1n))).toEqual({ ok: false, error: "too-large" });
  });
});

describe("fromBaseUnits", () => {
  it("is the exact inverse of toBaseUnits", () => {
    for (const input of ["0", "1", "1.5", "0.0000001", "123456789.1234567"]) {
      const parsed = toBaseUnits(input);
      expect(parsed.ok).toBe(true);
      if (parsed.ok) expect(fromBaseUnits(parsed.value)).toBe(input);
    }
  });

  it("strips insignificant trailing zeros", () => {
    expect(fromBaseUnits(15_000_000n)).toBe("1.5");
    expect(fromBaseUnits(10_000_000n)).toBe("1");
    expect(fromBaseUnits(1n)).toBe("0.0000001");
  });

  it("demo and on-chain parsers agree on table", () => {
    const table = ["", "0", "1.", ".5", "1e3", "0.00000001", "1".repeat(1000), "-1", "1,5"];
    for (const item of table) {
      const onchain = toBaseUnits(item);
      const demo = parseAmount(item);
      expect(demo).toEqual(onchain);
    }
  });

  it("round trips", () => {
    fc.assert(
      fc.property(
        fc.bigInt({ min: 0n, max: MAX_I128 }),
        (baseUnits) => {
          const str = fromBaseUnits(baseUnits);
          const parsed = toBaseUnits(str);
          expect(parsed).toEqual({ ok: true, value: baseUnits });
        },
      ),
      { numRuns: 100 },
    );
  });
});
