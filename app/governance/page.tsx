import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { WalletProvider } from "@/components/wallet";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { GovernanceView } from "@/components/governance-view";
import { config } from "@/lib/config";
import { AUDIT_PAGE_SIZE, createContractReader, getGovernanceSnapshot } from "@/lib/governance";

export const metadata = { title: "Governance - StellarLend" };
export const revalidate = 60;

export default async function Page({ searchParams }: { searchParams?: Promise<{ audit?: string }> }) {
  const messages = await getMessages({ locale: "en" });
  const requested = Number((await searchParams)?.audit);
  const limit = Number.isInteger(requested) && requested > 0 ? Math.min(requested, 200) : AUDIT_PAGE_SIZE;
  const snapshot = config.lendingId ? await getGovernanceSnapshot(createContractReader(config.lendingId), limit) : null;

  return (
    <NextIntlClientProvider locale="en" messages={messages}>
      <WalletProvider>
        <Header />
        <main className="mx-auto max-w-6xl px-4 py-10">
          <h1 className="mb-6 text-2xl font-bold">Governance &amp; risk configuration</h1>
          {snapshot ? (
            <GovernanceView snapshot={snapshot} auditLimit={limit} contractId={config.lendingId} />
          ) : (
            <p className="text-sm text-gray-500">Lending contract is not configured.</p>
          )}
        </main>
        <Footer />
      </WalletProvider>
    </NextIntlClientProvider>
  );
}
