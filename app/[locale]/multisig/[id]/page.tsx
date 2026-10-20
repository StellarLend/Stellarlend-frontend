import { ProposalDetail } from "@/components/multisig/proposal-detail";
import { PageShell } from "@/components/page-shell";

export const metadata = {
  title: "Multisig Proposal - StellarLend",
  description: "Review and sign multisig governance proposals via Freighter wallet.",
};

export default async function Page({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  const proposalId = parseInt(id, 10) || 1;

  return (
    <PageShell locale={locale}>
      <ProposalDetail id={proposalId} />
    </PageShell>
  );
}
