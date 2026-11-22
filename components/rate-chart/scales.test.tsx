import { describe, expect, it } from "vitest";
import { generateTicks, xScale, yScale } from "./scales";

describe("rate chart scales", () => {
  it("maps and clamps values to plot bounds", () => {
    expect(xScale(0, 0, 10_000, 52, 616)).toBe(52);
    expect(xScale(5_000, 0, 10_000, 52, 616)).toBe(334);
    expect(xScale(20_000, 0, 10_000, 52, 616)).toBe(616);
    expect(yScale(100, 0, 1_000, 20, 202)).toBe(183.8);
    expect(yScale(-10, 0, 1_000, 20, 202)).toBe(202);
  });

  it("maps degenerate domains to the center of the range", () => {
    expect(xScale(5, 5, 5, 10, 30)).toBe(20);
    expect(yScale(5, 5, 5, 10, 30)).toBe(20);
  });

  it("generates evenly spaced ticks and handles equal bounds", () => {
    expect(generateTicks(0, 10, 4)).toEqual([0, 2.5, 5, 7.5, 10]);
    expect(generateTicks(5, 5)).toEqual([5]);
  });
});
