import React from "react";
import { Tooltip } from "@/components/atoms/Tooltip/Tooltip";
import type { NotificationStreamConnectionState } from "@/hooks/useNotificationStream";

const STREAM_STATUS_COPY: Record<NotificationStreamConnectionState, { label: string; tooltip: string; dotClassName: string }> = {
  connected: {
    label: "Live",
    tooltip: "Live notifications are connected and updating in real time.",
    dotClassName: "bg-emerald-300",
  },
  reconnecting: {
    label: "Reconnecting",
    tooltip: "Live notifications are trying to reconnect. Updates may be delayed briefly.",
    dotClassName: "bg-amber-300",
  },
  offline: {
    label: "Offline",
    tooltip: "Live notifications are offline. New alerts will appear after the connection is restored.",
    dotClassName: "bg-red-300",
  },
};

interface StreamStatusIndicatorProps {
  connectionState: NotificationStreamConnectionState;
  className?: string;
}

const StreamStatusIndicator = ({ connectionState, className = "" }: StreamStatusIndicatorProps) => {
  const copy = STREAM_STATUS_COPY[connectionState];

  return (
    <Tooltip content={copy.tooltip}>
      <button
        type="button"
        aria-label={`Notification stream status: ${copy.label}`}
        title={copy.tooltip}
        className={`inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/10 px-2.5 py-1 text-xs font-medium text-white transition-colors hover:bg-white/15 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/80 focus-visible:ring-offset-2 focus-visible:ring-offset-green-600 ${className}`.trim()}
      >
        <span
          aria-hidden="true"
          className={`h-2 w-2 rounded-full ${copy.dotClassName}`}
        />
        <span>{copy.label}</span>
      </button>
    </Tooltip>
  );
};

export default StreamStatusIndicator;
