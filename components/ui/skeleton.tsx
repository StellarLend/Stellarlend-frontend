import React from "react";
import { cn } from "./utils";

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  label?: string;
}

export function Skeleton({ className, label, children, ...props }: SkeletonProps) {
  if (label) {
    return (
      <div
        role="status"
        aria-busy="true"
        aria-label={label}
        className={cn("space-y-8", className)}
        {...props}
      >
        {children}
      </div>
    );
  }

  return (
    <div
      aria-hidden="true"
      className={cn("animate-pulse rounded bg-neutral-800", className)}
      {...props}
    />
  );
}
