import React from "react";

/** Shared page wrapper. Layout handles locale, providers, header, main, and footer. */
export function PageShell({
  children,
}: {
  locale?: string;
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
