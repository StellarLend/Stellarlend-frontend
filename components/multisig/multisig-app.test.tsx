import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { listProposals } from "@/lib/multisig/reads";
import { MultisigApp } from "./multisig-app";

vi.mock("@/lib/config", () => ({
  config: { multisigId: "test-contract" },
  explorer: () => "#",
  accountExplorer: () => "#",
  getExpectedNetworkPassphrase: () => "test-passphrase",
  isNetworkMismatch: () => false,
  NetworkMismatchError: class extends Error {},
}));

vi.mock("@/lib/multisig/reads", () => ({
  listProposals: vi.fn(),
}));

vi.mock("./proposal-actions", () => ({
  BatchProposalActions: () => null,
}));

vi.mock("./create-proposal", () => ({
  CreateProposal: () => null,
}));

const proposals = [
  {
    id: 1,
    proposer: "GTEST",
    action: "Set threshold",
    status: "Active" as const,
    payloadHash: "",
    approvals: [],
    signerSetHash: "",
    expiresAtLedger: 130,
  },
  {
    id: 2,
    proposer: "GTEST",
    action: "Execute action",
    status: "Executed" as const,
    payloadHash: "",
    approvals: [],
    signerSetHash: "",
    expiresAtLedger: 130,
  },
];

describe("MultisigApp paging and status tabs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.history.replaceState(null, "", "/multisig");
    vi.mocked(listProposals).mockResolvedValue({
      overview: {
        threshold: 1,
        signers: [],
        signerSetHash: "",
        currentLedger: 100,
      },
      proposals,
      nextCursor: null,
      failedProposalIds: [],
    });
  });

  it("uses accessible URL-backed tabs without refetching the current page", async () => {
    const user = userEvent.setup();
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={queryClient}>
        <MultisigApp />
      </QueryClientProvider>
    );

    expect(await screen.findByText("#1")).toBeTruthy();
    expect(listProposals).toHaveBeenCalledTimes(1);
    expect(listProposals).toHaveBeenCalledWith(
      expect.objectContaining({ cursor: 0, pageSize: 10 })
    );
    expect(screen.getByRole("tablist")).toBeTruthy();

    await user.click(screen.getByRole("tab", { name: /Executed/ }));
    await waitFor(() => expect(screen.getByText("#2")).toBeTruthy());
    expect(screen.queryByText("#1")).toBeNull();
    expect(listProposals).toHaveBeenCalledTimes(1);
    expect(new URLSearchParams(window.location.search).get("filter")).toBe("executed");

    fireEvent.keyDown(screen.getByRole("tab", { name: /Executed/ }), {
      key: "ArrowRight",
    });
    expect(screen.getByRole("tab", { name: /Cancelled/ }).getAttribute("aria-selected")).toBe("true");
    expect(new URLSearchParams(window.location.search).get("filter")).toBe("cancelled");
    expect(listProposals).toHaveBeenCalledTimes(1);
  });
});
