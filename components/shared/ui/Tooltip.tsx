"use client";
import React from "react";

interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

const Tooltip: React.FC<TooltipProps> = ({ content, children, className }) => (
  <div className={`relative group inline-block ${className ?? ""}`}>
    {children}
    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-50 px-2 py-1 text-xs text-white bg-gray-800 rounded whitespace-nowrap">
      {content}
    </div>
  </div>
);

export default Tooltip;
