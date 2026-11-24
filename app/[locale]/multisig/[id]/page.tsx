import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ProposalDetail } from "@/components/multisig/proposal-detail";
import { PageShell } from "@/components/page-shell";
import { buildMetadata } from "@/lib/site";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}): Promise<Metadata> {
  const { locale, id } = await params;
  const proposalId = parseInt(id, 10) || 1;
  const t = await getTranslations({ locale, namespace: "meta.multisigProposal" });

  return buildMetadata({
    locale,
    path: `/multisig/${proposalId}`,
    title: t("title"),
    description: t("description"),
  });
}

export default async function Page({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  const proposalId = parseInt(id, 10) || 1;

  return (
    <PageShell locale={locale}>
      <ProposalDetail id={proposalId} />
    </PageShell>
  );
}
