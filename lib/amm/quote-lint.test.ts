import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("No Number arithmetic in quote math", () => {
  it("enforces BigInt math without Number() arithmetic operations in quote.ts", () => {
    const content = readFileSync(resolve(process.cwd(), "lib/amm/quote.ts"), "utf-8");
    expect(content).not.toMatch(/parseFloat\(/);
    expect(content).not.toMatch(/parseInt\(/);
    expect(content).toMatch(/checkedMul\(amountIn, feeBps\)/);
    expect(content).toMatch(/10_000n/);
    expect(content).toMatch(/1n << 127n/);
  });
});
