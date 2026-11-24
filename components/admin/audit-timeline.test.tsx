// @vitest-environment jsdom

import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import en from "@/messages/en.json";
import { AuditTimeline } from "./audit-timeline";
import * as adminEventsModule from "@/lib/admin-events";

describe("AuditTimeline", () => {
  it("renders audit timeline panel and items", async () => {
    vi.spyOn(adminEventsModule, "getAdminEvents").mockResolvedValueOnce({
      events: [
        {
          id: "event-1",
          kind: "pause_set",
          action: "Pause Deposit",
          actor: "GA5W...SKYH",
          ledger: 100,
          txHash: "tx1",
          pauseType: "Deposit",
          expiresAtLedger: 200,
          remainingSeconds: 500,
          isExpired: false,
        },
      ],
      cursor: "c1",
      hasMore: false,
    });

    render(
      <NextIntlClientProvider locale="en" messages={en}>
        <AuditTimeline currentLedger={100} />
      </NextIntlClientProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText("Emergency & Role Audit Timeline")).toBeTruthy();
      expect(screen.getByText("Pause Deposit")).toBeTruthy();
    });
  });
});
