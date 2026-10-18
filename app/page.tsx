import Link from "next/link";
import { MARKETS, fmt } from "@/lib/markets";

const features = [
  ["Supply and earn", "Deposit assets into pools and earn variable yield, accrued every ledger."],
  ["Borrow against collateral", "Borrow up to your collateral's LTV with a live health factor so you always see liquidation risk."],
  ["Built on Soroban", "Lending logic lives in audited-style Rust smart contracts on Stellar, with sub-5s finality and tiny fees."],
  ["Wallet-native", "Connect Freighter in one click. No wallet? Explore everything in demo mode."],
];

export default function Home() {
  const tvl = MARKETS.reduce((s, m) => s + m.totalSupply * m.price, 0);
  const borrowed = MARKETS.reduce((s, m) => s + m.totalBorrow * m.price, 0);
  return (
    <div className="space-y-16">
      <section className="pt-8 text-center">
        <p className="mb-4 inline-block rounded-full border border-[var(--line)] px-3 py-1 text-xs mut">Live on Stellar testnet</p>
        <h1 className="mx-auto max-w-3xl text-4xl font-extrabold leading-tight sm:text-6xl">
          Lend and borrow on <span className="grad">Stellar</span>
        </h1>
        <p className="mx-auto mt-5 max-w-xl mut">StellarLend is an over-collateralised money market on Soroban. Supply assets to earn yield, or borrow against what you hold.</p>
        <div className="mt-8 flex justify-center gap-3">
          <Link href="/markets" className="btn">Launch app</Link>
          <Link href="/docs" className="btn-ghost">Read the docs</Link>
        </div>
      </section>
      <section className="grid gap-4 sm:grid-cols-3">
        {[["Total supplied", `$${fmt(tvl / 1e6, 1)}M`], ["Total borrowed", `$${fmt(borrowed / 1e6, 1)}M`], ["Markets", String(MARKETS.length)]].map(([k, v]) => (
          <div key={k} className="card p-6 text-center"><div className="text-3xl font-bold">{v}</div><div className="mut text-sm">{k}</div></div>
        ))}
      </section>
      <section className="grid gap-4 sm:grid-cols-2">
        {features.map(([t, d]) => (
          <div key={t} className="card p-6"><h3 className="font-semibold">{t}</h3><p className="mut mt-2 text-sm">{d}</p></div>
        ))}
      </section>
      <p className="text-center text-xs mut">Market figures shown are illustrative testnet/demo data.</p>
    </div>
  );
}
