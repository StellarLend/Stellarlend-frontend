import { ProposalDetail } from "@/components/multisig/proposal-detail";
import { PageShell } from "@/components/page-shell";

export const metadata = {
  title: "Multisig Proposal Details - StellarLend",
  description:
    "Review decoded proposal actions, signer quorum progress, and ledger expiry for StellarLend multisig governance.",
};

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const proposalId = parseInt(id, 10) || 1;

  return (
    <PageShell>
      <ProposalDetail id={proposalId} />
    </PageShell>
  );
}
