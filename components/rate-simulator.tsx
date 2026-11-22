"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  BPS_DENOM,
  borrowRateBps,
  formatBpsPercent,
  type RateParams,
} from "@/lib/rate-model";
import type { RateChartOverlay } from "./rate-chart";

type SimulatorField =
  | "utilization"
  | "baseRate"
  | "slope1"
  | "slope2"
  | "kink";

type Draft = Record<SimulatorField, string>;

type Simulation = {
  params: RateParams;
  utilizationBps: bigint;
  borrowApyBps: bigint;
  supplyApyBps: bigint;
};

function formatInputPercent(bps: bigint): string {
  const whole = bps / 100n;
  const fraction = (bps % 100n).toString().padStart(2, "0");
  return `${whole}.${fraction}`;
}

function percentToBps(value: string): bigint | null {
  const match = /^(?:(\d+)(?:\.(\d{0,2}))?|\.(\d{1,2}))$/.exec(value.trim());
  if (!match) return null;

  const whole = match[1] ?? "0";
  const fraction = (match[2] ?? match[3] ?? "").padEnd(2, "0");
  return BigInt(whole) * 100n + BigInt(fraction || "0");
}

function createDraft(params: RateParams, utilizationBps: bigint): Draft {
  return {
    utilization: formatInputPercent(utilizationBps),
    baseRate: formatInputPercent(params.base_rate_bps),
    slope1: formatInputPercent(params.multiplier_bps),
    slope2: formatInputPercent(params.jump_multiplier_bps),
    kink: formatInputPercent(params.kink_utilization_bps),
  };
}

function simulate(draft: Draft, baseParams: RateParams): Simulation | null {
  const utilizationBps = percentToBps(draft.utilization);
  const baseRateBps = percentToBps(draft.baseRate);
  const slope1Bps = percentToBps(draft.slope1);
  const slope2Bps = percentToBps(draft.slope2);
  const kinkBps = percentToBps(draft.kink);

  if (
    utilizationBps === null ||
    baseRateBps === null ||
    slope1Bps === null ||
    slope2Bps === null ||
    kinkBps === null ||
    utilizationBps > BPS_DENOM ||
    kinkBps > BPS_DENOM
  ) {
    return null;
  }

  const params: RateParams = {
    ...baseParams,
    base_rate_bps: baseRateBps,
    multiplier_bps: slope1Bps,
    jump_multiplier_bps: slope2Bps,
    kink_utilization_bps: kinkBps,
  };
  const borrowApyBps = borrowRateBps(utilizationBps, params);

  return {
    params,
    utilizationBps,
    borrowApyBps,
    supplyApyBps: (borrowApyBps * utilizationBps) / BPS_DENOM,
  };
}

function findInvalidField(draft: Draft): SimulatorField | null {
  for (const field of [
    "utilization",
    "baseRate",
    "slope1",
    "slope2",
    "kink",
  ] as const) {
    const bps = percentToBps(draft[field]);
    if (bps === null) return field;
    if ((field === "utilization" || field === "kink") && bps > BPS_DENOM) {
      return field;
    }
  }
  return null;
}

function toSliderValue(value: string, fallbackBps: bigint): string {
  const bps = percentToBps(value);
  const bounded =
    bps === null ? fallbackBps : bps > BPS_DENOM ? BPS_DENOM : bps;
  return formatInputPercent(bounded);
}

export type RateSimulatorProps = {
  params: RateParams;
  utilizationBps: bigint;
  onOverlayChange: (overlay: RateChartOverlay | undefined) => void;
};

export function RateSimulator({
  params,
  utilizationBps,
  onOverlayChange,
}: RateSimulatorProps) {
  const t = useTranslations("market.rateSimulator");
  const [draft, setDraft] = useState(() => createDraft(params, utilizationBps));
  const [simulation, setSimulation] = useState(
    () => simulate(createDraft(params, utilizationBps), params)!
  );
  const [invalidField, setInvalidField] = useState<SimulatorField | null>(null);

  function updateField(field: SimulatorField, value: string) {
    const nextDraft = { ...draft, [field]: value };
    setDraft(nextDraft);

    const nextSimulation = simulate(nextDraft, params);
    if (!nextSimulation) {
      setInvalidField(findInvalidField(nextDraft));
      return;
    }

    setInvalidField(null);
    setSimulation(nextSimulation);
    onOverlayChange({
      params: nextSimulation.params,
      utilizationBps: nextSimulation.utilizationBps,
    });
  }

  function reset() {
    const resetDraft = createDraft(params, utilizationBps);
    const resetSimulation = simulate(resetDraft, params)!;
    setDraft(resetDraft);
    setSimulation(resetSimulation);
    setInvalidField(null);
    onOverlayChange(undefined);
  }

  const fields: Array<{
    key: SimulatorField;
    label: string;
    slider?: boolean;
  }> = [
    { key: "utilization", label: t("utilization"), slider: true },
    { key: "baseRate", label: t("baseRate") },
    { key: "slope1", label: t("slope1") },
    { key: "slope2", label: t("slope2") },
    { key: "kink", label: t("kink"), slider: true },
  ];

  return (
    <section
      className="card space-y-5 p-6"
      aria-labelledby="rate-simulator-heading"
      data-testid="rate-simulator"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="rate-simulator-heading" className="text-xl font-semibold">
            {t("title")}
          </h2>
          <p className="mut mt-1 text-sm">{t("subtitle")}</p>
        </div>
        <button
          type="button"
          className="btn-ghost rounded-[10px] px-3 py-2 text-sm"
          onClick={reset}
        >
          {t("reset")}
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {fields.map(({ key, label, slider }) => {
          const inputId = `rate-simulator-${key}`;
          return (
            <div className="space-y-2" key={key}>
              <label className="block text-sm font-medium" htmlFor={inputId}>
                {label}
              </label>
              <input
                id={inputId}
                type="number"
                min="0"
                max={slider ? "100" : undefined}
                step="0.01"
                inputMode="decimal"
                value={draft[key]}
                aria-invalid={invalidField === key}
                aria-describedby={
                  invalidField === key ? "rate-simulator-error" : undefined
                }
                onChange={(event) => updateField(key, event.target.value)}
                className="w-full rounded-lg border border-[var(--line)] bg-[#0a1020] px-3 py-2 text-sm"
              />
              {slider && (
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="0.01"
                  value={toSliderValue(
                    draft[key],
                    key === "utilization"
                      ? simulation.utilizationBps
                      : simulation.params.kink_utilization_bps
                  )}
                  aria-label={t("sliderLabel", { label })}
                  aria-invalid={invalidField === key}
                  aria-describedby={
                    invalidField === key ? "rate-simulator-error" : undefined
                  }
                  onChange={(event) => updateField(key, event.target.value)}
                  className="w-full accent-[var(--acc)]"
                />
              )}
            </div>
          );
        })}
      </div>

      {invalidField && (
        <p
          id="rate-simulator-error"
          className="text-sm text-red-400"
          role="alert"
          data-testid="rate-simulator-error"
        >
          {t("invalidInput")}
        </p>
      )}

      <dl
        className="grid gap-3 sm:grid-cols-2"
        aria-live="polite"
        data-testid="rate-simulator-results"
      >
        <div className="rounded-xl border border-[var(--line)] bg-[#0a1020] p-4">
          <dt className="mut text-sm">{t("borrowApy")}</dt>
          <dd
            className="mt-1 text-xl font-semibold"
            data-testid="simulated-borrow-apy"
          >
            {formatBpsPercent(simulation.borrowApyBps)}
          </dd>
        </div>
        <div className="rounded-xl border border-[var(--line)] bg-[#0a1020] p-4">
          <dt className="mut text-sm">{t("supplyApy")}</dt>
          <dd
            className="mt-1 text-xl font-semibold text-emerald-400"
            data-testid="simulated-supply-apy"
          >
            {formatBpsPercent(simulation.supplyApyBps)}
          </dd>
        </div>
      </dl>
    </section>
  );
}

export default RateSimulator;
