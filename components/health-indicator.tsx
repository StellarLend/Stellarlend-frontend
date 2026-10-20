"use client";

import { HealthChip } from "@/components/health-chip";
import { useHealthMonitor } from "@/hooks/use-health-monitor";
import { useWallet } from "@/components/wallet-provider"; // CHANGE: your wallet hook's file and name

function ConnectedHealthChip({ address }: { address: string }) {
  const monitor = useHealthMonitor(address);
  return (
    <HealthChip
      health={monitor.health}
      level={monitor.level}
      status={monitor.status}
      thresholds={monitor.thresholds}
      onSaveThresholds={monitor.setThresholds}
      notifications={monitor.notifications}
    />
  );
}

export function HealthIndicator() {
  const { address } = useWallet(); // CHANGE: your hook name and address field
  if (!address) return null;
  return <ConnectedHealthChip key={address} address={address} />;
}