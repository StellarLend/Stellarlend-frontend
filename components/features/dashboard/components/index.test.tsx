import { afterEach, describe, expect, expectTypeOf, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";

import * as dashboardComponents from "./index";
import type { TimeWindow } from "./index";
import FilterPresetsModule from "./FilterPresets";
import LiquidationsPanelModule from "./LiquidationsPanel";
import MetricsCardsModule from "./MetricsCards";
import NetWorthTrendModule from "./NetWorthTrend";
import NextPaymentDueModule from "./NextPaymentDue";
import PositionSummaryModule from "./PositionSummary";
import SearchResultsModule from "./SearchResults";
import TransactionDetailModule from "./TransactionDetail";
import TransactionReceiptModule from "./TransactionReceipt";
import { TransactionsSummaryHeader as TransactionsSummaryHeaderModule } from "./TransactionsSummaryHeader";

/**
 * Contract tests for `components/features/dashboard/components/index.ts`.
 *
 * The barrel is the supported entry point for the dashboard feature, so the
 * failure modes pinned down here are:
 *
 *  1. Surface drift  - a binding is dropped or renamed and consumers silently
 *     receive `undefined` instead of a component (or a new accidental export
 *     quietly widens the public API).
 *  2. Mis-wiring     - a copy/paste alias points an export at the wrong module.
 *  3. Type leakage   - the type-only `TimeWindow` re-export must stay erased at
 *     runtime instead of showing up as an `undefined` value binding.
 *  4. Import-time side effects - evaluating the barrel must not touch the
 *     network/storage, otherwise server rendering and re-imports break.
 *  5. Module duplication - the barrel reached through two specifiers (alias vs
 *     relative) must yield one module instance; two instances silently break
 *     hook/context identity.
 *  6. Corruptible surface - a consumer must not be able to overwrite a binding,
 *     and reading an unknown member must be safe (returns `undefined`).
 *  7. Usability - components reached *through* the barrel must still render their
 *     boundary/failure states, not merely typecheck.
 */

/** Runtime exports of the barrel, kept in sync deliberately: a change here is a
 * public API change and must ship with a compatibility plan. */
const EXPECTED_EXPORTS = [
  "MetricsCards",
  "SearchResults",
  "TransactionsSummaryHeader",
  "LiquidationsPanel",
  "PositionSummary",
  "NextPaymentDue",
  "TransactionDetail",
  "TransactionReceipt",
  "NetWorthTrend",
  "FilterPresets",
] as const;

/** `React.forwardRef` components are objects, plain components are functions. */
const isRenderableComponent = (value: unknown): boolean =>
  typeof value === "function" ||
  (typeof value === "object" && value !== null && "$$typeof" in value);

const sortedKeys = (module: object) => Object.keys(module).sort();

describe("dashboard components barrel: public surface", () => {
  it("exposes exactly the documented components and nothing else", () => {
    expect(sortedKeys(dashboardComponents)).toEqual(
      [...EXPECTED_EXPORTS].sort(),
    );
  });

  it("does not add a default export (would silently change the contract)", () => {
    expect("default" in dashboardComponents).toBe(false);
  });

  it("resolves every export to a defined, renderable component", () => {
    for (const name of EXPECTED_EXPORTS) {
      const binding = dashboardComponents[name];

      expect(binding, `${name} must be exported`).toBeDefined();
      expect(binding, `${name} must not be null`).not.toBeNull();
      expect(
        isRenderableComponent(binding),
        `${name} must be a renderable React component`,
      ).toBe(true);
    }
  });

  it("keeps the type-only TimeWindow export erased at runtime", () => {
    // Guards against a future `export { TimeWindow }` (value re-export) that
    // would hand JavaScript consumers an `undefined` binding.
    expect("TimeWindow" in dashboardComponents).toBe(false);
    expectTypeOf<TimeWindow>().toEqualTypeOf<"24h" | "7d" | "30d">();
  });

  it("returns undefined instead of throwing for unknown members", () => {
    const namespace = dashboardComponents as unknown as Record<string, unknown>;

    expect(namespace.NotARealComponent).toBeUndefined();
    expect(namespace[""]).toBeUndefined();
    expect(namespace.MetricsCardsExtra).toBeUndefined();
  });

  it("keeps the surface stable across repeated reads (deterministic order)", () => {
    const first = sortedKeys(dashboardComponents).join(",");

    for (let attempt = 0; attempt < 5; attempt += 1) {
      expect(sortedKeys(dashboardComponents).join(",")).toBe(first);
    }
  });
});

describe("dashboard components barrel: binding identity", () => {
  it("re-exports the default export of each component module", () => {
    expect(dashboardComponents.MetricsCards).toBe(MetricsCardsModule);
    expect(dashboardComponents.SearchResults).toBe(SearchResultsModule);
    expect(dashboardComponents.LiquidationsPanel).toBe(LiquidationsPanelModule);
    expect(dashboardComponents.PositionSummary).toBe(PositionSummaryModule);
    expect(dashboardComponents.NextPaymentDue).toBe(NextPaymentDueModule);
    expect(dashboardComponents.TransactionDetail).toBe(TransactionDetailModule);
    expect(dashboardComponents.TransactionReceipt).toBe(TransactionReceiptModule);
    expect(dashboardComponents.NetWorthTrend).toBe(NetWorthTrendModule);
    expect(dashboardComponents.FilterPresets).toBe(FilterPresetsModule);
  });

  it("forwards the named TransactionsSummaryHeader export as-is", () => {
    expect(dashboardComponents.TransactionsSummaryHeader).toBe(
      TransactionsSummaryHeaderModule,
    );
  });

  it("never aliases distinct exports to the same module (copy/paste guard)", () => {
    const bindings = EXPECTED_EXPORTS.map((name) => dashboardComponents[name]);

    expect(new Set(bindings).size).toBe(EXPECTED_EXPORTS.length);
  });
});

describe("dashboard components barrel: parent barrel forwarding", () => {
  it("forwards every binding unchanged through components/index.ts", async () => {
    // `components/index.ts` re-exports this barrel with `export *`, so the
    // public `@/components` path must expose identical references.
    const parent = await import("@/components");

    for (const name of EXPECTED_EXPORTS) {
      expect(parent[name], `${name} missing from @/components`).toBe(
        dashboardComponents[name],
      );
    }

    expect("TimeWindow" in parent).toBe(false);
  });
});

describe("dashboard components barrel: import failure paths", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("imports without performing network work (SSR-safe, side-effect free)", async () => {
    const fetchSpy = vi.fn(() => Promise.reject(new Error("network disabled")));
    vi.stubGlobal("fetch", fetchSpy);
    vi.resetModules();

    const reimported = await import("./index");

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(sortedKeys(reimported)).toEqual([...EXPECTED_EXPORTS].sort());
  });

  it("resolves concurrent imports to one consistent module instance", async () => {
    vi.resetModules();

    const [first, second, third] = await Promise.all([
      import("./index"),
      import("./index"),
      import("./index"),
    ]);

    expect(first).toBe(second);
    expect(second).toBe(third);
    expect(sortedKeys(first)).toEqual([...EXPECTED_EXPORTS].sort());
  });

  it("cannot produce a partial surface when re-imported after a module reset", async () => {
    const before = await import("./index");
    const surface = sortedKeys(before);

    vi.resetModules();
    const after = await import("./index");

    expect(sortedKeys(after)).toEqual(surface);
    for (const name of EXPECTED_EXPORTS) {
      expect(after[name], `${name} missing after re-import`).toBeDefined();
    }
  });

  it("resolves alias and relative specifiers to the same bindings", async () => {
    vi.resetModules();

    const [viaAlias, viaRelative] = await Promise.all([
      import("@/components/features/dashboard/components"),
      import("./index"),
    ]);

    for (const name of EXPECTED_EXPORTS) {
      expect(viaAlias[name]).toBe(viaRelative[name]);
    }
  });

  it("does not let a consumer overwrite a public binding", () => {
    const original = dashboardComponents.MetricsCards;
    const namespace = dashboardComponents as unknown as Record<string, unknown>;

    try {
      namespace.MetricsCards = "tampered";
    } catch {
      // Strict-mode module namespaces throw on assignment; either way the
      // surface below must remain intact.
    }

    expect(dashboardComponents.MetricsCards).toBe(original);
    expect(dashboardComponents.MetricsCards).toBe(MetricsCardsModule);
  });
});

describe("dashboard components barrel: consumer contract", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders PositionSummary's failure state through the barrel", async () => {
    // PositionSummary mounts data-loading children, so freeze the network and
    // flush mount effects inside act to keep the boundary state deterministic.
    vi.stubGlobal("fetch", vi.fn(() => new Promise<never>(() => {})));

    await act(async () => {
      render(<dashboardComponents.PositionSummary data={null} />);
    });

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Unable to load position summary",
    );
  });

  it("renders LiquidationsPanel's empty boundary state through the barrel", () => {
    render(<dashboardComponents.LiquidationsPanel initialPositions={[]} />);

    expect(
      screen.getByRole("heading", { name: "Liquidation Risk" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("No liquidation risk positions found."),
    ).toBeInTheDocument();
  });

  it("renders TransactionsSummaryHeader's loading boundary through the barrel", () => {
    render(
      <dashboardComponents.TransactionsSummaryHeader
        inflow={0}
        outflow={0}
        net={0}
        isLoading
      />,
    );

    expect(screen.getByText("Loading summary...")).toBeInTheDocument();
  });
});
