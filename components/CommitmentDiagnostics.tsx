/**
 * Commitment Diagnostics Dashboard Component
 * Displays real-time health metrics and operational insights
 */

"use client";

import { useMemo } from "react";
import type { TelemetryEvent } from "@/types/commitment";
import { useCommitmentTelemetry } from "@/lib/telemetry/commitmentTelemetry";

interface CommitmentDiagnosticsProps {
  events: TelemetryEvent[];
  className?: string;
}

/**
 * Diagnostic dashboard for monitoring commitment actions
 */
export default function CommitmentDiagnostics({
  events,
  className = "",
}: CommitmentDiagnosticsProps) {
  const { generateDiagnostics, getAggregation } = useCommitmentTelemetry();

  const diagnostics = useMemo(
    () => (events.length > 0 ? generateDiagnostics(events) : null),
    [events, generateDiagnostics],
  );

  const aggregation = useMemo(
    () => (events.length > 0 ? getAggregation(events) : null),
    [events, getAggregation],
  );

  if (!diagnostics || !aggregation) {
    return null;
  }

  const healthColors = {
    healthy: "bg-emerald-100 text-emerald-800 border-emerald-200",
    degraded: "bg-amber-100 text-amber-800 border-amber-200",
    critical: "bg-red-100 text-red-800 border-red-200",
  };

  const healthIcons = {
    healthy: "✓",
    degraded: "⚠",
    critical: "✗",
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Health Status */}
      <div
        className={`rounded-lg border p-4 ${healthColors[diagnostics.health]}`}
        role="status"
        aria-live="polite"
      >
        <div className="flex items-center justify-between">
          <h4 className="flex items-center gap-2 text-sm font-semibold">
            <span className="text-lg" aria-hidden="true">
              {healthIcons[diagnostics.health]}
            </span>
            <span>System Health: {diagnostics.health.toUpperCase()}</span>
          </h4>
          <span className="text-xs">
            {events.length} event{events.length !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg border border-slate-200 bg-white p-3">
          <dt className="text-xs font-medium text-slate-500">Success Rate</dt>
          <dd className="mt-1 text-xl font-semibold text-slate-900">
            {diagnostics.metrics.successRate.toFixed(1)}%
          </dd>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-3">
          <dt className="text-xs font-medium text-slate-500">Avg Latency</dt>
          <dd className="mt-1 text-xl font-semibold text-slate-900">
            {Math.round(diagnostics.metrics.averageLatency)}ms
          </dd>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-3">
          <dt className="text-xs font-medium text-slate-500">Error Rate</dt>
          <dd className="mt-1 text-xl font-semibold text-slate-900">
            {diagnostics.metrics.errorRate.toFixed(1)}%
          </dd>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-3">
          <dt className="text-xs font-medium text-slate-500">Circuit Breaker</dt>
          <dd className="mt-1 flex items-center gap-1">
            <span
              className={`inline-block h-3 w-3 rounded-full ${
                diagnostics.metrics.circuitBreakerStatus === "open"
                  ? "bg-red-500"
                  : "bg-emerald-500"
              }`}
              aria-label={diagnostics.metrics.circuitBreakerStatus}
            />
            <span className="text-sm font-semibold text-slate-900">
              {diagnostics.metrics.circuitBreakerStatus}
            </span>
          </dd>
        </div>
      </div>

      {/* Issues */}
      {diagnostics.issues.length > 0 && (
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <h4 className="mb-3 text-sm font-semibold text-slate-900">Active Issues</h4>
          <ul className="space-y-2">
            {diagnostics.issues.map((issue, idx) => {
              const severityColors = {
                warning: "text-amber-700 bg-amber-50",
                error: "text-red-700 bg-red-50",
                critical: "text-red-900 bg-red-100",
              };

              return (
                <li
                  key={idx}
                  className={`flex items-start gap-2 rounded p-2 text-xs ${severityColors[issue.severity]}`}
                >
                  <span className="font-bold">{issue.severity.toUpperCase()}:</span>
                  <span className="flex-1">{issue.message}</span>
                  {issue.count > 1 && (
                    <span className="rounded-full bg-white/50 px-2 py-0.5 font-semibold">
                      ×{issue.count}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Recommendations */}
      {diagnostics.recommendations.length > 0 && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
          <h4 className="mb-2 text-sm font-semibold text-blue-900">Recommendations</h4>
          <ul className="space-y-1 text-xs text-blue-800">
            {diagnostics.recommendations.map((rec, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <span className="mt-0.5">•</span>
                <span>{rec}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Event Type Breakdown */}
      {Object.keys(aggregation.eventCounts).length > 0 && (
        <details className="rounded-lg border border-slate-200 bg-white p-4">
          <summary className="cursor-pointer text-sm font-semibold text-slate-900">
            Event Breakdown
          </summary>
          <div className="mt-3 space-y-1">
            {Object.entries(aggregation.eventCounts)
              .sort(([, a], [, b]) => b - a)
              .map(([type, count]) => (
                <div key={type} className="flex items-center justify-between text-xs">
                  <span className="font-mono text-slate-600">{type}</span>
                  <span className="font-semibold text-slate-900">{count}</span>
                </div>
              ))}
          </div>
        </details>
      )}

      {/* Latency Breakdown */}
      {Object.keys(aggregation.averageLatencies).length > 0 && (
        <details className="rounded-lg border border-slate-200 bg-white p-4">
          <summary className="cursor-pointer text-sm font-semibold text-slate-900">
            Average Latencies
          </summary>
          <div className="mt-3 space-y-1">
            {Object.entries(aggregation.averageLatencies)
              .sort(([, a], [, b]) => b - a)
              .map(([key, latency]) => (
                <div key={key} className="flex items-center justify-between text-xs">
                  <span className="font-mono text-slate-600">{key}</span>
                  <span className="font-semibold text-slate-900">{Math.round(latency)}ms</span>
                </div>
              ))}
          </div>
        </details>
      )}
    </div>
  );
}
