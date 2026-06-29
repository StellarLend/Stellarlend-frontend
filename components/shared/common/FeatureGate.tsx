"use client";

import type { ReactNode } from "react";
import { useFeatureFlag } from "@/hooks/useFeatureFlag";

export interface FeatureGateProps {
  flag: string;
  children: ReactNode;
  fallback?: ReactNode;
}

export function FeatureGate({ flag, children, fallback }: FeatureGateProps) {
  const isEnabled = useFeatureFlag(flag);

  if (!isEnabled) {
    return fallback ?? null;
  }

  return <>{children}</>;
}
