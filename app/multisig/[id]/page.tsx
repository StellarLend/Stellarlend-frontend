import { ProposalDetail } from "@/components/multisig/proposal-detail";

export const metadata = {
  title: "Multisig Proposal - StellarLend",
  description: "Review and sign multisig governance proposals via Freighter wallet.",
};

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const proposalId = parseInt(id, 10) || 1;

  return <ProposalDetail id={proposalId} />;
}
