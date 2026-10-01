import { describe, it, expect } from "vitest";
import { buildCrumbs } from "./Breadcrumbs";

describe("buildCrumbs", () => {
  it("builds a trail for a multi-segment known path", () => {
    const crumbs = buildCrumbs("/dashboard/transactions");
    expect(crumbs).toEqual([
      { label: "Home", href: "/" },
      { label: "Dashboard", href: "/dashboard" },
      { label: "Transactions", href: "/dashboard/transactions" },
    ]);
  });

  it("title-cases an unknown segment", () => {
    const crumbs = buildCrumbs("/dashboard/my-portfolio");
    expect(crumbs[2]).toEqual({ label: "My portfolio", href: "/dashboard/my-portfolio" });
  });

  it("falls back to Details for a UUID segment", () => {
    const crumbs = buildCrumbs("/dashboard/transactions/123e4567-e89b-12d3-a456-426614174000");
    expect(crumbs[3].label).toBe("Details");
  });

  it("falls back to Details for a numeric ID segment", () => {
    const crumbs = buildCrumbs("/dashboard/transactions/42");
    expect(crumbs[3].label).toBe("Details");
  });

  it("always starts with Home", () => {
    expect(buildCrumbs("/")[0]).toEqual({ label: "Home", href: "/" });
  });
});
