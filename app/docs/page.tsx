import { config, explorer } from "@/lib/config";
export const metadata = { title: "Docs - StellarLend" };

const S = ({ t, children }: { t: string; children: React.ReactNode }) => (
  <section className="space-y-3"><h2 className="text-2xl font-semibold">{t}</h2><div className="mut space-y-3 text-sm leading-relaxed">{children}</div></section>
);

export default function Docs() {
  return (
    <article className="mx-auto max-w-3xl space-y-10">
      <h1 className="text-4xl font-bold">Documentation</h1>
      <S t="Overview"><p>StellarLend is an over-collateralised lending market on Stellar. Users supply assets to earn interest and borrow other assets against their collateral. Core logic is implemented as Soroban smart contracts; this web app is the user interface.</p></S>
      <S t="Getting started">
        <ol className="list-decimal space-y-1 pl-5">
          <li>Install the <a className="break-all underline" href="https://freighter.app" target="_blank" rel="noreferrer">Freighter</a> wallet and switch it to Testnet.</li>
          <li>Fund your account with the Stellar testnet friendbot.</li>
          <li>Open <a className="break-all underline" href="/markets">Markets</a> and click Connect Freighter. Without a wallet the app runs in demo mode.</li>
          <li>Pick an asset, then Supply, Borrow, Withdraw or Repay.</li>
        </ol>
      </S>
      <S t="Risk parameters">
        <p>Each asset has a loan-to-value (LTV) ratio. Your borrowing limit is the sum of collateral value times LTV. The health factor is borrowing limit divided by borrowed value; below 1.0 a position becomes liquidatable.</p>
      </S>
      <S t="Architecture">
        <p>Next.js 15 (App Router) front end, Freighter for signing, Horizon for balances, Soroban RPC for contract calls. Position state in this build is a local demo ledger; contract invocation is configured through environment variables.</p>
      </S>
      <S t="Deployed contracts (testnet)">
        <ul className="space-y-1 break-all font-mono text-xs">
          <li>Lending: {config.lendingId ? <a className="break-all underline" href={explorer(config.lendingId)} target="_blank" rel="noreferrer">{config.lendingId}</a> : "not deployed"}</li>
        </ul>
      </S>
      <S t="Environment variables">
        <ul className="list-disc space-y-1 pl-5 font-mono text-xs">
          {["NEXT_PUBLIC_STELLAR_NETWORK", "NEXT_PUBLIC_HORIZON_URL", "NEXT_PUBLIC_SOROBAN_RPC_URL", "NEXT_PUBLIC_LENDING_CONTRACT_ID"].map((v) => <li key={v}>{v}</li>)}
        </ul>
      </S>
    </article>
  );
}
