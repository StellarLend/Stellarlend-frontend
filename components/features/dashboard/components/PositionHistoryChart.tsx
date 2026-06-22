"use client";

import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";

type Interval = "1h" | "1d" | "7d" | "30d";

interface SnapshotPoint {
  timestamp: number;
  supplied: number;
  borrowed: number;
  effectiveSupplyApy: number;
  effectiveBorrowApy: number;
}

interface HistoryResponse {
  snapshots: SnapshotPoint[];
  interval: Interval;
  bucketCount: number;
}

const INTERVALS: Interval[] = ["1h", "1d", "7d", "30d"];
const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_RANGE_MS = 365 * DAY_MS;

const toDateInput = (timestamp: number) => format(new Date(timestamp), "yyyy-MM-dd");

const buildPath = (
  points: SnapshotPoint[],
  key: "supplied" | "borrowed",
  width: number,
  height: number,
) => {
  if (points.length === 0) return "";

  const maxValue = Math.max(...points.flatMap((point) => [point.supplied, point.borrowed]), 1);
  const lastIndex = Math.max(points.length - 1, 1);

  return points
    .map((point, index) => {
      const x = (index / lastIndex) * width;
      const y = height - (point[key] / maxValue) * height;
      return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
};

export default function PositionHistoryChart() {
  const now = Date.now();
  const [interval, setInterval] = useState<Interval>("1d");
  const [fromDate, setFromDate] = useState(toDateInput(now - 90 * DAY_MS));
  const [toDate, setToDate] = useState(toDateInput(now));
  const [snapshots, setSnapshots] = useState<SnapshotPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fromMs = new Date(`${fromDate}T00:00:00Z`).getTime();
  const toMs = new Date(`${toDate}T23:59:59Z`).getTime();
  const rangeError =
    Number.isFinite(fromMs) && Number.isFinite(toMs) && toMs - fromMs > MAX_RANGE_MS
      ? "Date range cannot exceed 365 days."
      : null;

  useEffect(() => {
    if (rangeError || !Number.isFinite(fromMs) || !Number.isFinite(toMs) || fromMs >= toMs) {
      setSnapshots([]);
      setIsLoading(false);
      setError(rangeError ?? "Choose a valid date range.");
      return;
    }

    const controller = new AbortController();
    const params = new URLSearchParams({
      interval,
      from: String(fromMs),
      to: String(toMs),
    });

    setIsLoading(true);
    setError(null);

    fetch(`/api/positions/history?${params.toString()}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Unable to load position history.");
        }

        return (await response.json()) as HistoryResponse;
      })
      .then((data) => {
        setSnapshots(data.snapshots ?? []);
      })
      .catch((err) => {
        if (!controller.signal.aborted) {
          setSnapshots([]);
          setError(err instanceof Error ? err.message : "Unable to load position history.");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      });

    return () => controller.abort();
  }, [fromMs, interval, rangeError, toMs]);

  const chartPaths = useMemo(
    () => ({
      supplied: buildPath(snapshots, "supplied", 640, 180),
      borrowed: buildPath(snapshots, "borrowed", 640, 180),
    }),
    [snapshots],
  );

  return (
    <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm" aria-labelledby="position-history-title">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 id="position-history-title" className="text-xl font-semibold text-slate-900">
            Position History
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Supplied, borrowed, and effective APY snapshots from `/api/positions/history`.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <label className="text-sm font-medium text-slate-700">
            From
            <input
              className="mt-1 block rounded-lg border border-slate-300 px-3 py-2 text-sm"
              type="date"
              value={fromDate}
              onChange={(event) => setFromDate(event.target.value)}
            />
          </label>
          <label className="text-sm font-medium text-slate-700">
            To
            <input
              className="mt-1 block rounded-lg border border-slate-300 px-3 py-2 text-sm"
              type="date"
              value={toDate}
              onChange={(event) => setToDate(event.target.value)}
            />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Interval
            <select
              className="mt-1 block rounded-lg border border-slate-300 px-3 py-2 text-sm"
              value={interval}
              onChange={(event) => setInterval(event.target.value as Interval)}
            >
              {INTERVALS.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {isLoading ? (
        <div className="mt-6 h-56 animate-pulse rounded-xl bg-slate-100" aria-label="Loading position history" />
      ) : error ? (
        <p className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700" role="alert">
          {error}
        </p>
      ) : snapshots.length === 0 ? (
        <p className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
          No position history snapshots are available for this range.
        </p>
      ) : (
        <>
          <div className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-slate-50 p-4">
            <svg viewBox="0 0 640 220" role="img" aria-labelledby="position-history-chart-title" className="h-64 w-full">
              <title id="position-history-chart-title">Supplied and borrowed balances over time</title>
              <line x1="0" y1="180" x2="640" y2="180" stroke="#cbd5e1" />
              <path d={chartPaths.supplied} fill="none" stroke="#059669" strokeWidth="4" strokeLinecap="round" />
              <path d={chartPaths.borrowed} fill="none" stroke="#2563eb" strokeWidth="4" strokeLinecap="round" />
            </svg>
            <div className="mt-3 flex flex-wrap gap-4 text-sm">
              <span className="font-semibold text-emerald-700">Supplied</span>
              <span className="font-semibold text-blue-700">Borrowed</span>
            </div>
          </div>

          <div className="mt-6 overflow-x-auto">
            <table className="min-w-full text-left text-sm" aria-label="Position history data">
              <thead className="text-slate-600">
                <tr>
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Supplied</th>
                  <th className="px-3 py-2">Borrowed</th>
                  <th className="px-3 py-2">Supply APY</th>
                  <th className="px-3 py-2">Borrow APY</th>
                </tr>
              </thead>
              <tbody>
                {snapshots.map((snapshot) => (
                  <tr key={snapshot.timestamp} className="border-t border-slate-100">
                    <td className="px-3 py-2">{format(new Date(snapshot.timestamp), "MMM d, yyyy")}</td>
                    <td className="px-3 py-2">{snapshot.supplied.toLocaleString()}</td>
                    <td className="px-3 py-2">{snapshot.borrowed.toLocaleString()}</td>
                    <td className="px-3 py-2">{snapshot.effectiveSupplyApy.toFixed(2)}%</td>
                    <td className="px-3 py-2">{snapshot.effectiveBorrowApy.toFixed(2)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
