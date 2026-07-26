"use client";

/**
 * Accessibility announcement component for lending action statuses.
 *
 * Every lending action form (lend / borrow / repay / withdraw) MUST render
 * this component with its corresponding `type` prop so that screen-reader
 * users receive live feedback when a form transitions through
 * idle -> submitting -> success / error states.
 *
 * If a new lending action type is added to the app, both the `type` union
 * below and each form that implements that action must include a
 * `<StatusAnnouncer>` instance.
 */

import React, { useEffect, useState } from "react";

export type AnnouncerStatus = "idle" | "submitting" | "success" | "error";

interface StatusAnnouncerProps {
  status: AnnouncerStatus;
  message?: string;
  type: "lend" | "borrow" | "repay" | "withdraw";
}

export default function StatusAnnouncer({
  status,
  message,
  type,
}: StatusAnnouncerProps) {
  const [announcement, setAnnouncement] = useState("");

  useEffect(() => {
    if (status === "idle") {
      setAnnouncement("");
      return;
    }

    let text = "";
    if (status === "submitting") {
      text = `Submitting ${type} request...`;
    } else if (status === "success") {
      text = message || `${type} request completed successfully.`;
    } else if (status === "error") {
      text = message || `An error occurred during ${type} request.`;
    }

    setAnnouncement(text);
  }, [status, message, type]);

  return (
    <div
      className="sr-only"
      role="status"
      aria-live="polite"
      aria-atomic="true"
      data-testid="status-announcer"
    >
      {announcement}
    </div>
  );
}
