export interface SvgPoint {
  x: number;
  y: number;
}

/**
 * Converts an array of {x, y} point coordinates into an SVG path string ("M x y L x y ...").
 *
 * @param points Array of point objects with x and y numeric properties.
 * @param precision Number of decimal places to format coordinates (default: 2).
 * @returns An SVG path string formatted for 'd' attributes.
 */
export function buildSvgPath(points: SvgPoint[], precision: number = 2): string {
  if (points.length === 0) {
    return "";
  }

  return points
    .map((point, index) => {
      const command = index === 0 ? "M" : "L";
      return `${command} ${point.x.toFixed(precision)} ${point.y.toFixed(precision)}`;
    })
    .join(" ");
}
