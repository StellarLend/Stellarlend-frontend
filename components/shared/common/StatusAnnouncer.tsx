"use client";

import React, { useEffect, useState } from "react";

export type AnnouncerStatus = "idle" | "submitting" | "success" | "error";

interface StatusAnnouncerProps {
  status: AnnouncerStatus;
  message?: string;
  type: "lend" | "borrow" | "repay";
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
    >
      {announcement}
    </div>
  );
}
