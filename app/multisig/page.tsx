import { MultisigApp } from "@/components/multisig/multisig-app";
import { PageShell } from "@/components/page-shell";

export const metadata = {
  title: "Multisig Governance Explorer - StellarLend",
  description:
    "Explore StellarLend multisig signers, quorum threshold, decoded proposal actions, and ledger expiry.",
};

export default function Page() {
  return (
    <PageShell>
      <MultisigApp />
    </PageShell>
  );
}
