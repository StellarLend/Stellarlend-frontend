import { describe, expect, it } from "vitest";
import { buildSvgPath } from "./svg";

describe("buildSvgPath", () => {
  it("returns an empty string when points array is empty", () => {
    expect(buildSvgPath([])).toBe("");
  });

  it("formats a single point with an M command", () => {
    expect(buildSvgPath([{ x: 10, y: 20 }])).toBe("M 10.00 20.00");
  });

  it("formats multiple points with M for the first point and L for subsequent points", () => {
    const points = [
      { x: 0, y: 10 },
      { x: 50, y: 25.5 },
      { x: 100, y: 5 },
    ];
    expect(buildSvgPath(points)).toBe("M 0.00 10.00 L 50.00 25.50 L 100.00 5.00");
  });

  it("supports custom precision formatting", () => {
    const points = [
      { x: 10.1234, y: 20.5678 },
      { x: 30.9, y: 40.1 },
    ];
    expect(buildSvgPath(points, 1)).toBe("M 10.1 20.6 L 30.9 40.1");
    expect(buildSvgPath(points, 0)).toBe("M 10 21 L 31 40");
  });
});
