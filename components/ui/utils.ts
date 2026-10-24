export type ClassValue = string | number | boolean | undefined | null | ClassValue[];

/**
 * Lightweight classNames / clsx alternative with zero external dependencies.
 */
export function cn(...inputs: ClassValue[]): string {
  const classes: string[] = [];
  for (const input of inputs) {
    if (!input) continue;
    if (typeof input === "string") {
      classes.push(input);
    } else if (Array.isArray(input)) {
      const inner = cn(...input);
      if (inner) classes.push(inner);
    }
  }
  return classes.join(" ");
}
