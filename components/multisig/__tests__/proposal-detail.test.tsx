import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Proposal, ProposalStatus } from "@/lib/multisig/types";
import { getProposalDetail } from "@/lib/multisig/reads";
import { getStatusDisplay } from "@/lib/multisig/status";
import { verifyAuthEntryBinding } from "@/lib/multisig/binding";
import { isSigner } from "@/lib/multisig/actions";
import { ProposalDetail } from "../proposal-detail";

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
  getProposalDetail: vi.fn(),
}));

vi.mock("@/lib/multisig/actions", () => ({
  isSigner: vi.fn(),
  approveProposal: vi.fn(),
  executeProposal: vi.fn(),
  batchExecuteProposals: vi.fn(),
  cancelProposal: vi.fn(),
}));

const baseProposal: Proposal = {
  id: 7,
  proposer: "GPROPOSER",
  action: "Set threshold",
  status: "Active",
  payloadHash: "a1b2c3",
  approvals: ["GAPPROVER"],
  signerSetHash: "a".repeat(64),
  expiresAtLedger: 200,
  threshold: 2,
  totalSigners: 3,
};

describe("ProposalDetail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    wallet.address = null;
    vi.mocked(getProposalDetail).mockResolvedValue(baseProposal);
    vi.mocked(isSigner).mockResolvedValue(false);
  });

  it("shows a loading state while the proposal is being read", () => {
    vi.mocked(getProposalDetail).mockReturnValue(new Promise(() => {}));

    render(<ProposalDetail id={7} />);

    expect(screen.getByText(/Loading multisig proposal #7/i)).toBeInTheDocument();
  });

  it("shows an error state when the read fails", async () => {
    vi.mocked(getProposalDetail).mockRejectedValue(new Error("RPC unavailable"));

    render(<ProposalDetail id={7} />);

    expect(await screen.findByText(/RPC unavailable/)).toBeInTheDocument();
    expect(screen.getByText(/Proposal #7 Not Found/i)).toBeInTheDocument();
  });

  it("renders executed badge", async () => {
    vi.mocked(getProposalDetail).mockResolvedValue({
      ...baseProposal,
      status: "Executed",
    });

    render(<ProposalDetail id={7} />);

    const badge = await screen.findByTestId("proposal-status-badge");
    expect(badge).toHaveTextContent("Executed");
  });

  it.each([
    ["Active", "Active"],
    ["Passed", "Passed"],
    ["Cancelled", "Cancelled"],
    ["Expired", "Expired"],
  ] as const)("renders %s badge from the status helper", async (status, expected) => {
    const proposal = { ...baseProposal, status };
    vi.mocked(getProposalDetail).mockResolvedValue(proposal);

    render(<ProposalDetail id={7} />);

    const badge = await screen.findByTestId("proposal-status-badge");
    expect(badge).toHaveTextContent(getStatusDisplay(proposal, undefined).displayText);
    expect(badge).toHaveTextContent(expected);
  });

  it("shows the signer set hash mismatch warning when binding verification fails", async () => {
    const bindingVerificationFailed = !verifyAuthEntryBinding(null, Buffer.alloc(32));
    expect(bindingVerificationFailed).toBe(true);

    vi.mocked(getProposalDetail).mockResolvedValue({
      ...baseProposal,
      signerSetChanged: bindingVerificationFailed,
      proposalSignerSetHash: "a".repeat(64),
      currentSignerSetHash: "b".repeat(64),
    });

    render(<ProposalDetail id={7} />);

    expect(await screen.findByTestId("signer-set-changed-warning")).toBeInTheDocument();
    expect(screen.getByText(/signer set changed; approvals invalid/i)).toBeInTheDocument();
  });

  it("shows approvals count against the threshold", async () => {
    render(<ProposalDetail id={7} />);

    expect(await screen.findByText(/1 \/ 2/)).toBeInTheDocument();
    expect(screen.getByText(/signers approved/i)).toBeInTheDocument();
  });

  it("hides actions for non signer", async () => {
    wallet.address = "GNONSIGNER";
    vi.mocked(isSigner).mockResolvedValue(false);

    render(<ProposalDetail id={7} />);

    expect(await screen.findByTestId("unauthorized-signer-notice")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByTestId("btn-approve")).toBeDisabled();
      expect(screen.getByTestId("btn-execute")).toBeDisabled();
      expect(screen.getByTestId("btn-cancel")).toBeDisabled();
    });
  });

  it("shows a status override badge when the helper reports an effective status", async () => {
    const expiredProposal: Proposal = {
      ...baseProposal,
      status: "Active" as ProposalStatus,
      effectiveStatus: "Expired",
    };
    vi.mocked(getProposalDetail).mockResolvedValue(expiredProposal);

    render(<ProposalDetail id={7} />);

    const badge = await screen.findByTestId("proposal-status-badge");
    expect(badge).toHaveTextContent("stored: Active · effective: Expired");
  });
});
