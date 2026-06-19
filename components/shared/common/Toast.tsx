"use client";

import React from "react";

export type ToastVariant = "processing" | "success" | "error" | "info";

interface ToastProps {
  id?: string;
  title?: string;
  description?: string;
  variant?: ToastVariant;
}

export default function Toast({
  title,
  description,
  variant = "info",
}: ToastProps) {
  const variantClasses =
    variant === "success"
      ? "bg-green-50 text-green-800 border border-green-200"
      : variant === "error"
        ? "bg-red-50 text-red-800 border border-red-200"
        : variant === "processing"
          ? "bg-yellow-50 text-yellow-800 border border-yellow-200"
          : "bg-blue-50 text-blue-800 border border-blue-200";

  return (
    <div
      className={`fixed right-4 top-6 z-50 max-w-sm p-3 rounded-lg shadow-lg ${variantClasses}`}
      role="status"
      aria-live="polite"
    >
      {title && <div className="font-medium mb-1">{title}</div>}
      {description && <div className="text-sm">{description}</div>}
    </div>
  );
}
