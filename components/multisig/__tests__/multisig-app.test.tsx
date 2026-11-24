import React from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createQueryClient } from "@/components/query-provider";
import { listProposals } from "@/lib/multisig/reads";
import { Proposal, ProposalStatus } from "@/lib/multisig/types";
import { getStatusDisplay } from "@/lib/multisig/status";
import { MultisigApp } from "../multisig-app";

const wallet = vi.hoisted(() => ({
  address: null as string | null,
}));

vi.mock("@/lib/config", () => ({
  config: { multisigId: "test-contract", lendingId: "test-lending" },
  explorer: () => "#",
  accountExplorer: () => "#",
  txExplorer: () => "#",
}));

vi.mock("@/components/wallet", () => ({
  useWallet: () => ({ address: wallet.address }),
}));

vi.mock("@/lib/multisig/reads", () => ({
  listProposals: vi.fn(),
}));

vi.mock("../proposal-actions", () => ({
  BatchProposalActions: () => null,
}));

vi.mock("../create-proposal", () => ({
  CreateProposal: () => null,
}));

const overview = {
  threshold: 2,
  signers: ["GSIGNER_1", "GSIGNER_2", "GSIGNER_3"],
  signerSetHash: "a".repeat(64),
  currentLedger: 100,
};

function makeProposal(id: number, status: ProposalStatus): Proposal {
  return {
    id,
    proposer: "GPROPOSER",
    action: `Action ${id}`,
    status,
    payloadHash: "a1b2c3",
    approvals: id === 1 ? ["GSIGNER_1"] : [],
    signerSetHash: "a".repeat(64),
    expiresAtLedger: 200,
    threshold: 2,
    totalSigners: 3,
  };
}

function renderApp() {
  const queryClient = createQueryClient();
  queryClient.setDefaultOptions({ queries: { retry: false } });

  return render(
    <QueryClientProvider client={queryClient}>
      <MultisigApp />
    </QueryClientProvider>
  );
}

describe("MultisigApp", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    wallet.address = null;
    window.history.replaceState(null, "", "/multisig");
  });

  it("renders loading state", () => {
    vi.mocked(listProposals).mockReturnValue(new Promise(() => {}));

    renderApp();

    expect(screen.getByText(/Loading multisig proposals from Soroban RPC/i)).toBeInTheDocument();
  });

  it("renders empty list state", async () => {
    vi.mocked(listProposals).mockResolvedValue({
      overview,
      proposals: [],
      nextCursor: null,
      failedProposalIds: [],
    });

    renderApp();

    expect(await screen.findByText("No proposals found")).toBeInTheDocument();
    expect(
      screen.getByText(/No multisig proposals have been created yet/i)
    ).toBeInTheDocument();
  });

  it("shows list error", async () => {
    vi.mocked(listProposals).mockRejectedValue(new Error("RPC endpoint unavailable"));

    renderApp();

    expect(await screen.findByText(/RPC endpoint unavailable/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Retry/i })).toBeInTheDocument();
  });

  it("renders status badges for pending, approved, executed, cancelled and expired", async () => {
    const statuses: ProposalStatus[] = [
      "Active",
      "Passed",
      "Executed",
      "Cancelled",
      "Expired",
    ];
    const proposals = statuses.map((status, index) => makeProposal(index + 1, status));

    vi.mocked(listProposals).mockResolvedValue({
      overview,
      proposals,
      nextCursor: null,
      failedProposalIds: [],
    });

    renderApp();

    expect(await screen.findByText("#5")).toBeInTheDocument();
    for (const proposal of proposals) {
      const row = screen.getByText(`#${proposal.id}`).closest("tr");
      expect(row).toHaveTextContent(
        getStatusDisplay(proposal, overview.currentLedger).displayText
      );
    }
    expect(screen.getByRole("tab", { name: /Pending \(1\)/ })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Approved \(1\)/ })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Executed \(1\)/ })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Cancelled \(1\)/ })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Expired \(1\)/ })).toBeInTheDocument();
  });

  it("shows approval count against the threshold", async () => {
    vi.mocked(listProposals).mockResolvedValue({
      overview,
      proposals: [makeProposal(1, "Active")],
      nextCursor: null,
      failedProposalIds: [],
    });

    renderApp();

    await waitFor(() => {
      expect(screen.getByText(/1 \/ 2 signers/)).toBeInTheDocument();
    });
  });

  it("shows the signer set changed warning in the proposal list", async () => {
    vi.mocked(listProposals).mockResolvedValue({
      overview,
      proposals: [{ ...makeProposal(1, "Active"), signerSetChanged: true }],
      nextCursor: null,
      failedProposalIds: [],
    });

    renderApp();

    expect(
      await screen.findByText(/signer set changed; approvals invalid/i)
    ).toBeInTheDocument();
  });
});
