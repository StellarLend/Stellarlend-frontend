import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render as rtlRender, screen, fireEvent, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import messages from "@/messages/en.json";
import { CreateProposal } from "../create-proposal";
import { buildProposalArgs, createProposal, isSigner } from "@/lib/multisig/actions";
import { decodeScVal } from "@/lib/multisig/decode";

const render = (ui: React.ReactElement, options?: any) =>
  rtlRender(ui, {
    wrapper: ({ children }: { children: React.ReactNode }) => (
      <NextIntlClientProvider locale="en" messages={messages}>
        {children}
      </NextIntlClientProvider>
    ),
    ...options,
  });

const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

vi.mock("@/components/wallet", () => ({
  useWallet: vi.fn(() => ({
    address: "GBSRKAMUOPCLSN75TJLM52HF55R6KOH7PMSA4XDNPXXNBDWBTLMPJEOI",
    connect: vi.fn(),
    disconnect: vi.fn(),
  })),
}));

vi.mock("@/lib/multisig/actions", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/multisig/actions")>();
  return {
    ...actual,
    isSigner: vi.fn().mockResolvedValue(true),
    createProposal: vi.fn().mockResolvedValue({
      txHash: "tx-create-123",
      status: "confirmed",
      proposalId: 7,
    }),
  };
});

describe("CreateProposal Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("hides the form when connected address is not a signer", async () => {
    vi.mocked(isSigner).mockResolvedValueOnce(false);
    const { container } = render(<CreateProposal contractId="CC4A6A46O2KQA7KEMOFK3TQ4YRSLCJ4ZP26SQWXIKNF4DTEX3BOL2HF6" />);

    await waitFor(() => {
      expect(isSigner).toHaveBeenCalled();
    });

    expect(screen.queryByTestId("create-proposal-form")).toBeNull();
    expect(container.innerHTML).toBe("");
  });

  it("renders decoded preview equal to decodeScVal output and navigates to /multisig/[id] on success", async () => {
    const onRefresh = vi.fn();
    render(
      <CreateProposal
        contractId="CC4A6A46O2KQA7KEMOFK3TQ4YRSLCJ4ZP26SQWXIKNF4DTEX3BOL2HF6"
        isSignerOverride={true}
        onRefresh={onRefresh}
      />
    );

    const select = screen.getByTestId("action-type-select");
    fireEvent.change(select, { target: { value: "SetThreshold" } });

    const thresholdInput = screen.getByTestId("input-threshold");
    fireEvent.change(thresholdInput, { target: { value: "3" } });

    const expectedFormatted = decodeScVal(buildProposalArgs("SetThreshold", { threshold: 3 })).formatted;
    expect(screen.getByTestId("proposal-decoded-preview").textContent).toBe(expectedFormatted);

    const submitBtn = screen.getByTestId("btn-submit-proposal");
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(createProposal).toHaveBeenCalledWith(
        "SetThreshold",
        { threshold: "3" },
        expect.objectContaining({
          signerAddress: "GBSRKAMUOPCLSN75TJLM52HF55R6KOH7PMSA4XDNPXXNBDWBTLMPJEOI",
        })
      );
    });

    await waitFor(() => {
      expect(onRefresh).toHaveBeenCalledTimes(1);
      expect(mockPush).toHaveBeenCalledWith("/multisig/7");
    });
  });

  it("decodes and displays contract errors when submission fails", async () => {
    vi.mocked(createProposal).mockRejectedValueOnce(new Error("HostError: Error(Contract, #1)"));

    render(
      <CreateProposal
        contractId="CC4A6A46O2KQA7KEMOFK3TQ4YRSLCJ4ZP26SQWXIKNF4DTEX3BOL2HF6"
        isSignerOverride={true}
      />
    );

    fireEvent.change(screen.getByTestId("action-type-select"), {
      target: { value: "SetThreshold" },
    });
    fireEvent.change(screen.getByTestId("input-threshold"), {
      target: { value: "2" },
    });

    fireEvent.click(screen.getByTestId("btn-submit-proposal"));

    await waitFor(() => {
      expect(screen.getByTestId("create-proposal-error").textContent).toContain(
        "Connected address is not an authorized signer for this multisig."
      );
    });

    expect(mockPush).not.toHaveBeenCalled();
  });
});
