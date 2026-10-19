import { describe, expect, it } from "vitest";
import { formatBps, formatDuration, formatTokenAmount, shortenAddress } from "./format";

describe("format helpers", () => {
  it("formats bps", () => {
    expect(formatBps(7500)).toBe("75%");
    expect(formatBps(1250)).toBe("12.5%");
    expect(formatBps(1)).toBe("0.01%");
    expect(formatBps(0)).toBe("0%");
  });
  it("formats durations", () => {
    expect(formatDuration(0)).toBe("0s");
    expect(formatDuration(90061)).toBe("1d 1h 1m 1s");
    expect(formatDuration(3600)).toBe("1h");
    expect(formatDuration(-1)).toBe("unavailable");
  });
  it("formats token amounts with 7 decimals", () => {
    expect(formatTokenAmount(10_000_000n)).toBe("1");
    expect(formatTokenAmount(12_345_678_901n)).toBe("1,234.5678901");
    expect(formatTokenAmount(5n)).toBe("0.0000005");
  });
  it("shortens addresses", () => {
    expect(shortenAddress("GABCDEFGHIJKLMNOPQRSTUVWXYZ")).toBe("GABCDE...WXYZ");
    expect(shortenAddress("GABC")).toBe("GABC");
  });
});
