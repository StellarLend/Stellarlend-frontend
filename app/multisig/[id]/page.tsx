import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ProposalDetail } from "@/components/multisig/proposal-detail";
import { PageShell } from "@/components/page-shell";
import { defaultLocale } from "@/i18n/routing";
import { buildMetadata } from "@/lib/site";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const proposalId = parseInt(id, 10) || 1;
  const t = await getTranslations({
    locale: defaultLocale,
    namespace: "meta.multisigProposal",
  });

  return buildMetadata({
    locale: defaultLocale,
    path: `/multisig/${proposalId}`,
    title: t("title"),
    description: t("description"),
  });
}

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
