import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ProposalActions, BatchProposalActions } from "../proposal-actions";
import { Proposal } from "@/lib/multisig/types";

// Mock wallet
vi.mock("@/components/wallet", () => ({
  useWallet: vi.fn(() => ({
    address: "GBSRKAMUOPCLSN75TJLM52HF55R6KOH7PMSA4XDNPXXNBDWBTLMPJEOI",
    connect: vi.fn(),
    disconnect: vi.fn(),
  })),
}));

// Mock actions
vi.mock("@/lib/multisig/actions", () => ({
  isSigner: vi.fn().mockResolvedValue(true),
  approveProposal: vi.fn().mockResolvedValue({ txHash: "tx123", status: "confirmed" }),
  executeProposal: vi.fn().mockResolvedValue({ txHash: "tx123", status: "confirmed" }),
  batchExecuteProposals: vi.fn().mockResolvedValue({ txHash: "tx123", status: "confirmed" }),
  cancelProposal: vi.fn().mockResolvedValue({ txHash: "tx123", status: "confirmed" }),
}));

describe("ProposalActions Component", () => {
  const activeProposal: Proposal = {
    id: 1,
    proposer: "GBSRKAMUOPCLSN75TJLM52HF55R6KOH7PMSA4XDNPXXNBDWBTLMPJEOI",
    action: "Update LTV ratio for XLM market to 75%",
    status: "Active",
    payloadHash: "4a5b6c7d8e9f0123456789abcdef0123456789abcdef0123456789abcdef0123",
    approvals: [],
    signerSetHash: "0000000000000000000000000000000000000000000000000000000000000001",
    expiresAtLedger: 1250000,
    threshold: 2,
    totalSigners: 3,
  };

  const passedProposal: Proposal = {
    ...activeProposal,
    id: 2,
    status: "Passed",
    approvals: [
      "GBSRKAMUOPCLSN75TJLM52HF55R6KOH7PMSA4XDNPXXNBDWBTLMPJEOI",
      "GBSXPC5X665CKCIUMUHLAKVRQNYA5XCNIWV2Q3QVUNLIVL7IJIQWTSFG",
    ],
  };

  const executedProposal: Proposal = {
    ...activeProposal,
    id: 3,
    status: "Executed",
    approvals: ["GBSRKAMUOPCLSN75TJLM52HF55R6KOH7PMSA4XDNPXXNBDWBTLMPJEOI"],
  };

  const expiredProposal: Proposal = {
    ...activeProposal,
    id: 4,
    status: "Expired",
    approvals: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("disables all action buttons and shows notice for non-signers", async () => {
    render(<ProposalActions proposal={activeProposal} isSignerOverride={false} />);

    const approveBtn = screen.getByTestId("btn-approve");
    const executeBtn = screen.getByTestId("btn-execute");
    const cancelBtn = screen.getByTestId("btn-cancel");

    expect((approveBtn as HTMLButtonElement).disabled).toBe(true);
    expect((executeBtn as HTMLButtonElement).disabled).toBe(true);
    expect((cancelBtn as HTMLButtonElement).disabled).toBe(true);

    expect(screen.getByTestId("unauthorized-signer-notice")).toBeDefined();
  });

  it("enables Approve and Cancel for authorized signers on Active proposal", async () => {
    render(<ProposalActions proposal={activeProposal} isSignerOverride={true} />);

    const approveBtn = screen.getByTestId("btn-approve");
    const executeBtn = screen.getByTestId("btn-execute");
    const cancelBtn = screen.getByTestId("btn-cancel");

    expect((approveBtn as HTMLButtonElement).disabled).toBe(false);
    expect((executeBtn as HTMLButtonElement).disabled).toBe(true); // Cannot execute Active proposal
    expect((cancelBtn as HTMLButtonElement).disabled).toBe(false);
  });

  it("disables Approve when connected wallet has already approved", async () => {
    const alreadyApprovedProposal: Proposal = {
      ...activeProposal,
      approvals: ["GBSRKAMUOPCLSN75TJLM52HF55R6KOH7PMSA4XDNPXXNBDWBTLMPJEOI"],
    };

    render(<ProposalActions proposal={alreadyApprovedProposal} isSignerOverride={true} />);

    const approveBtn = screen.getByTestId("btn-approve");
    expect((approveBtn as HTMLButtonElement).disabled).toBe(true);
    expect(approveBtn.textContent).toContain("Approved ✓");
  });

  it("enables Execute and disables Approve on Passed proposal", async () => {
    render(<ProposalActions proposal={passedProposal} isSignerOverride={true} />);

    const approveBtn = screen.getByTestId("btn-approve");
    const executeBtn = screen.getByTestId("btn-execute");
    const cancelBtn = screen.getByTestId("btn-cancel");

    expect((approveBtn as HTMLButtonElement).disabled).toBe(true); // No approve on Passed
    expect((executeBtn as HTMLButtonElement).disabled).toBe(false); // Execute enabled
    expect((cancelBtn as HTMLButtonElement).disabled).toBe(false);
  });

  it("disables Approve, Execute, and Cancel on Executed proposal", async () => {
    render(<ProposalActions proposal={executedProposal} isSignerOverride={true} />);

    expect((screen.getByTestId("btn-approve") as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByTestId("btn-execute") as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByTestId("btn-cancel") as HTMLButtonElement).disabled).toBe(true);
  });

  it("disables Approve on Expired proposal", async () => {
    render(<ProposalActions proposal={expiredProposal} isSignerOverride={true} />);

    expect((screen.getByTestId("btn-approve") as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByTestId("btn-execute") as HTMLButtonElement).disabled).toBe(true);
  });

  it("opens confirmation modal and displays decoded action details", async () => {
    render(<ProposalActions proposal={activeProposal} isSignerOverride={true} />);

    const approveBtn = screen.getByTestId("btn-approve");
    fireEvent.click(approveBtn);

    expect(screen.getByTestId("action-confirmation-modal")).toBeDefined();
    expect(screen.getByText(/Confirm approve Proposal #1/i)).toBeDefined();
    expect(screen.getByText(/Domain-bound Authorization Security/i)).toBeDefined();

    // Cancel modal
    const cancelModalBtn = screen.getByTestId("btn-modal-cancel");
    fireEvent.click(cancelModalBtn);

    expect(screen.queryByTestId("action-confirmation-modal")).toBeNull();
  });
});

describe("BatchProposalActions Component", () => {
  const passedList: Proposal[] = Array.from({ length: 35 }, (_, i) => ({
    id: i + 1,
    proposer: "GBSRKAMUOPCLSN75TJLM52HF55R6KOH7PMSA4XDNPXXNBDWBTLMPJEOI",
    action: `Action ${i + 1}`,
    status: "Passed",
    payloadHash: "4a5b6c7d8e9f" + String(i).padStart(52, "0"),
    approvals: ["GBSRKAMUOPCLSN75TJLM52HF55R6KOH7PMSA4XDNPXXNBDWBTLMPJEOI"],
    signerSetHash: "0000000000000000000000000000000000000000000000000000000000000001",
    expiresAtLedger: 1250000,
    threshold: 2,
    totalSigners: 3,
  }));

  it("renders Passed proposals and toggles selection", async () => {
    render(<BatchProposalActions proposals={passedList.slice(0, 3)} isSignerOverride={true} />);

    const checkbox1 = screen.getByTestId("checkbox-proposal-1");
    const checkbox2 = screen.getByTestId("checkbox-proposal-2");
    const executeBtn = screen.getByTestId("btn-batch-execute-open");

    expect((executeBtn as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(checkbox1);
    expect((executeBtn as HTMLButtonElement).disabled).toBe(false);
    expect(executeBtn.textContent).toContain("Execute Selected (1)");

    fireEvent.click(checkbox2);
    expect(executeBtn.textContent).toContain("Execute Selected (2)");
  });

  it("enforces batch limit of maximum 32 proposals in UI", async () => {
    render(<BatchProposalActions proposals={passedList} isSignerOverride={true} />);

    // Select 32 proposals
    for (let i = 1; i <= 32; i++) {
      const cb = screen.getByTestId(`checkbox-proposal-${i}`);
      fireEvent.click(cb);
    }

    const executeBtn = screen.getByTestId("btn-batch-execute-open");
    expect(executeBtn.textContent).toContain("Execute Selected (32)");

    // 33rd checkbox should be disabled
    const cb33 = screen.getByTestId("checkbox-proposal-33");
    expect((cb33 as HTMLInputElement).disabled).toBe(true);
    expect(screen.getByTestId("batch-limit-warning")).toBeDefined();
  });
});
