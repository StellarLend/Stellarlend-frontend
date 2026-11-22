import type { ReactNode } from "react";
import { formatBps, formatDuration, formatTokenAmount, shortenAddress } from "@/lib/format";
import { explorer } from "@/lib/config";
import { AUDIT_PAGE_SIZE, type Field, type GovernanceSnapshot } from "@/lib/governance";

const explorerAccount = (address: string) => `https://stellar.expert/explorer/testnet/account/${address}`;

function Row({ label, children, title }: { label: string; children: ReactNode; title?: string }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1 text-sm">
      <dt className="text-gray-500">{label}</dt>
      <dd className="break-all text-right font-medium" title={title}>{children}</dd>
    </div>
  );
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border p-4" aria-label={title}>
      <h2 className="mb-2 text-lg font-semibold">{title}</h2>
      <dl>{children}</dl>
    </section>
  );
}

function field<T>(f: Field<T>, render: (value: T) => { text: ReactNode; raw?: string }): { text: ReactNode; raw?: string } {
  return f.ok ? render(f.value) : { text: <span className="text-red-600">unavailable</span> };
}

function Val<T>({ label, f, render }: { label: string; f: Field<T>; render: (value: T) => { text: ReactNode; raw?: string } }) {
  const { text, raw } = field(f, render);
  return <Row label={label} title={raw}>{text}</Row>;
}

const addressOf = (v: string | null) =>
  v === null ? { text: "not set" } : { text: <a className="underline" href={explorerAccount(v)} target="_blank" rel="noreferrer">{shortenAddress(v)}</a>, raw: v };
const bps = (v: number) => ({ text: formatBps(v), raw: `${v} bps` });
const tokens = (v: bigint) => ({ text: `${formatTokenAmount(v)} tokens`, raw: v.toString() });

export function GovernanceView({ snapshot, auditLimit = AUDIT_PAGE_SIZE, contractId }: { snapshot: GovernanceSnapshot; auditLimit?: number; contractId?: string }) {
  const s = snapshot;
  return (
    <div className="space-y-6">
      {contractId && (
        <p className="text-sm text-gray-500">
          Contract: <a className="underline" href={explorer(contractId)} target="_blank" rel="noreferrer">{shortenAddress(contractId)}</a>
        </p>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        <Card title="Roles">
          <Val label="Admin" f={s.admin} render={addressOf} />
          <Val label="Guardian" f={s.guardian} render={addressOf} />
        </Card>
        <Card title="Supply & borrow limits">
          <Val label="Minimum borrow" f={s.minBorrow} render={tokens} />
          <Val label="Deposit cap" f={s.depositCap} render={tokens} />
          <Val label="Borrow cap" f={s.borrowCap} render={tokens} />
        </Card>
        <Card title="Liquidation">
          <Val label="Close factor" f={s.closeFactorBps} render={bps} />
          <Val label="Liquidation threshold" f={s.liquidationThresholdBps} render={bps} />
          <Val label="Liquidation incentive" f={s.liquidationIncentiveBps} render={bps} />
        </Card>
        <Card title="Interest-rate model">
          {s.rateParams.ok ? (
            Object.entries(s.rateParams.value).map(([key, value]) => {
              const isBps = key.endsWith("_bps");
              const isSeconds = key.endsWith("_seconds") || key.endsWith("_secs");
              const text = isBps ? formatBps(value) : isSeconds ? formatDuration(value) : value.toString();
              return <Row key={key} label={key} title={`${value.toString()}${isBps ? " bps" : ""}`}>{text}</Row>;
            })
          ) : (
            <Row label="Rate parameters"><span className="text-red-600">unavailable</span></Row>
          )}
        </Card>
        <Card title="Flash loans">
          <Val label="Max flash loan" f={s.maxFlashBps} render={bps} />
        </Card>
        <Card title="Oracle">
          <Val label="Oracle key" f={s.oracle} render={addressOf} />
        </Card>
      </div>

      <section aria-label="Governance audit log">
        <h2 className="mb-2 text-lg font-semibold">Governance audit log</h2>
        {!s.audit.ok ? (
          <p className="text-sm text-red-600">unavailable</p>
        ) : s.audit.value.length === 0 ? (
          <p className="text-sm text-gray-500">No entries yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr><th className="p-2">Sequence</th><th className="p-2">Action</th><th className="p-2">Actor</th><th className="p-2">Ledger</th></tr>
              </thead>
              <tbody>
                {s.audit.value.map((e) => (
                  <tr key={e.sequence.toString()} className="border-t">
                    <td className="p-2">{e.sequence.toString()}</td>
                    <td className="p-2">{e.action}</td>
                    <td className="p-2"><a className="underline" href={explorerAccount(e.actor)} target="_blank" rel="noreferrer" title={e.actor}>{shortenAddress(e.actor)}</a></td>
                    <td className="p-2">{e.ledger}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {s.audit.value.length >= auditLimit && (
              <a className="mt-3 inline-block text-sm underline" href={`?audit=${auditLimit + AUDIT_PAGE_SIZE}`}>Show more</a>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
