import { MultisigApp } from "@/components/multisig/multisig-app";

export const metadata = {
  title: "Multisig Governance - StellarLend",
  description: "Signer management and proposal execution for StellarLend multisig contract.",
};

export default function Page() {
  return <MultisigApp />;
}
