import type { RateChartLabels } from "./types";

export function RateChartLegend({ labels }: { labels: RateChartLabels }) {
  return (
    <>
      <span className="inline-flex items-center gap-1.5">
        <span
          className="inline-block h-2 w-4 rounded bg-[var(--acc)]"
          aria-hidden="true"
        />
        <span>{labels.legendCurve}</span>
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span
          className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-400"
          aria-hidden="true"
        />
        <span>{labels.legendAppliedRate}</span>
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span
          className="inline-block h-2.5 w-2.5 rounded-full border-2 border-indigo-400"
          aria-hidden="true"
        />
        <span>{labels.legendTargetRate}</span>
      </span>
    </>
  );
}
