import type { Metadata } from "next";
import { Shield, Lock, FileCheck, ShieldAlert } from "lucide-react";
import Header from "@/components/shared/layout/TopNav";
import Footer from "@/components/marketing/Footer";
import { PageHeader } from "@/components/shared/common";

export const metadata: Metadata = {
  title: "Security | StellarLend",
  description:
    "How StellarLend protects user funds: audited Soroban smart contracts, a non-custodial architecture, and how to report a vulnerability.",
};

const principles = [
  {
    icon: Shield,
    title: "Audited Smart Contracts",
    description:
      "StellarLend's lending and borrowing logic runs in Soroban smart contracts that go through independent security audits before and after major changes ship to mainnet.",
  },
  {
    icon: Lock,
    title: "Non-Custodial by Design",
    description:
      "StellarLend never takes custody of user funds. Assets are held and moved by the smart contracts themselves, governed by on-chain logic rather than a centralized operator.",
  },
  {
    icon: FileCheck,
    title: "Transparent, On-Chain Activity",
    description:
      "Every supply, borrow, repay and withdrawal is a Stellar network transaction, so activity is independently verifiable on-chain rather than trusted on our word.",
  },
];

const stats = [
  { value: "$2M+", label: "Total Value Locked" },
  { value: "0", label: "Security Incidents" },
  { value: "3s", label: "Avg. Transaction Time" },
  { value: "<0.01", label: "Transaction Fee (XLM)" },
];

export default function SecurityPage() {
  return (
    <div className="bg-black">
      <Header />

      <main className="mx-auto max-w-6xl px-4 py-16">
        <PageHeader
          tone="dark"
          title="Security"
          description="Our approach to keeping StellarLend's smart contracts, and the funds that flow through them, safe."
        />

        <section
          aria-labelledby="security-principles-heading"
          className="mt-4 grid gap-8 md:grid-cols-3"
        >
          <h2 id="security-principles-heading" className="sr-only">
            Security principles
          </h2>
          {principles.map((principle) => {
            const Icon = principle.icon;
            return (
              <div key={principle.title} className="flex flex-col gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[#15A350]/10">
                  <Icon className="h-6 w-6 text-[#15A350]" aria-hidden="true" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-white mb-2">
                    {principle.title}
                  </h3>
                  <p className="text-[#AAABAB]">{principle.description}</p>
                </div>
              </div>
            );
          })}
        </section>

        <section
          aria-labelledby="security-stats-heading"
          className="mt-16 grid grid-cols-2 gap-8 border-t border-[#1D2025] py-12 md:grid-cols-4"
        >
          <h2 id="security-stats-heading" className="sr-only">
            Security metrics
          </h2>
          {stats.map((stat) => (
            <div key={stat.label} className="text-center">
              <div className="mb-2 text-2xl font-bold text-[#15A350] md:text-3xl">
                {stat.value}
              </div>
              <div className="text-sm text-[#AAABAB]">{stat.label}</div>
            </div>
          ))}
        </section>

        <section
          aria-labelledby="report-vulnerability-heading"
          className="mt-8 flex flex-col gap-4 rounded-lg border border-[#1D2025] p-8 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex gap-4">
            <ShieldAlert
              className="h-6 w-6 flex-shrink-0 text-[#15A350]"
              aria-hidden="true"
            />
            <div>
              <h2
                id="report-vulnerability-heading"
                className="text-lg font-semibold text-white"
              >
                Report a vulnerability
              </h2>
              <p className="mt-1 text-[#AAABAB]">
                Found a security issue? Let us know so we can investigate and
                respond before it affects users.
              </p>
            </div>
          </div>
          <a
            href="mailto:contact@stellarlend.com"
            className="inline-flex flex-shrink-0 items-center justify-center rounded-lg border border-[#15A350] px-6 py-3 font-medium text-[#15A350] transition-all duration-300 hover:bg-[#15A350] hover:text-white"
          >
            contact@stellarlend.com
          </a>
        </section>
      </main>

      <Footer />
    </div>
  );
}
