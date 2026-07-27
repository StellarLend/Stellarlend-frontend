import React from "react";

interface IconPlaceholderProps {
  className?: string;
  width?: string | number;
  height?: string | number;
}

export const IconPlaceholder = ({
  className = "",
  width = "24",
  height = "24",
}: IconPlaceholderProps) => {
  return (
    <div
      className={`animate-pulse bg-gray-200 rounded ${className}`}
      style={{ width, height }}
      aria-hidden="true"
    />
  );
};
