import { BPS_DENOM, formatBpsPercent } from "@/lib/rate-model";
import { generateTicks, RATE_CHART } from "./scales";
import type { RateChartLabels } from "./types";

type RateChartAxesProps = {
  labels: RateChartLabels;
  maxRateBps: bigint;
  kinkUtilBps: bigint;
  toX: (utilizationBps: bigint) => number;
  toY: (rateBps: bigint) => number;
};

export function RateChartAxes({
  labels,
  maxRateBps,
  kinkUtilBps,
  toX,
  toY,
}: RateChartAxesProps) {
  const yTicks = generateTicks(0, Number(maxRateBps), 4);
  const xTicks = generateTicks(0, Number(BPS_DENOM), 4);
  const kinkX = toX(kinkUtilBps);

  return (
    <>
      {yTicks.map((tick, index) => {
        const rateAtTick = BigInt(Math.round(tick));
        const y = toY(rateAtTick);
        const fraction = index / 4;
        return (
          <g key={fraction}>
            <line
              x1={RATE_CHART.padLeft}
              y1={y}
              x2={RATE_CHART.width - RATE_CHART.padRight}
              y2={y}
              stroke="#1d2840"
              strokeDasharray={fraction === 0 ? undefined : "3 3"}
              strokeWidth="1"
            />
            <text
              x={RATE_CHART.padLeft - 8}
              y={y + 4}
              textAnchor="end"
              fill="#8b97b2"
              fontSize="10"
            >
              {formatBpsPercent(rateAtTick, 1)}
            </text>
          </g>
        );
      })}

      {xTicks.map((tick) => {
        const uTick = BigInt(tick);
        const x = toX(uTick);
        return (
          <g key={uTick.toString()}>
            <line
              x1={x}
              y1={RATE_CHART.height - RATE_CHART.padBottom}
              x2={x}
              y2={RATE_CHART.height - RATE_CHART.padBottom + 4}
              stroke="#8b97b2"
              strokeWidth="1"
            />
            <text
              x={x}
              y={RATE_CHART.height - 10}
              textAnchor="middle"
              fill="#8b97b2"
              fontSize="10"
            >
              {formatBpsPercent(uTick, 0)}
            </text>
          </g>
        );
      })}

      <line
        x1={kinkX}
        y1={RATE_CHART.padTop}
        x2={kinkX}
        y2={RATE_CHART.height - RATE_CHART.padBottom}
        stroke="#818cf8"
        strokeDasharray="4 4"
        strokeWidth="1"
        data-testid="kink-marker-line"
      />
    </>
  );
}
