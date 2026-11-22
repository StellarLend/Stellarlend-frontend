import { describe, expect, it } from "vitest";
import { buildPath, buildPolylinePoints } from "./curve";

describe("rate chart curve geometry", () => {
  it("returns an empty path for no curve points", () => {
    expect(buildPath([], 100)).toBe("");
  });

  it("builds stable polygon and polyline coordinates", () => {
    const points = [
      { x: 10, y: 80 },
      { x: 50.04, y: 20.05 },
    ];

    expect(buildPolylinePoints(points)).toBe("10.0,80.0 50.0,20.1");
    expect(buildPath(points, 100)).toBe(
      "M 10.0,100.0 L 10.0,80.0 L 50.0,20.1 L 50.0,100.0 Z"
    );
  });
});
