"use client";

import type { ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import { formatDuration, shortenAddress } from "@/lib/format";
import { explorer } from "@/lib/config";
import { AUDIT_PAGE_SIZE, type Field, type GovernanceSnapshot } from "@/lib/governance";

const explorerAccount = (address: string) => `https://stellar.expert/explorer/testnet/account/${address}`;

function formatLocaleBps(bps: number | bigint, locale: string): string {
  return new Intl.NumberFormat(locale, {
    style: "percent",
    maximumFractionDigits: 2,
  }).format(Number(bps) / 10_000);
}

function formatLocaleTokenAmount(raw: bigint, locale: string, decimals = 7): string {
  const negative = raw < 0n;
  const abs = negative ? -raw : raw;
  const base = 10n ** BigInt(decimals);
  const whole = abs / base;
  const fraction = (abs % base).toString().padStart(decimals, "0").replace(/0+$/, "");
  const formatter = new Intl.NumberFormat(locale);
  const wholeStr = formatter.format(whole);
  const decimalSep = formatter.formatToParts(1.1).find((p) => p.type === "decimal")?.value ?? ".";
  return `${negative ? "-" : ""}${wholeStr}${fraction ? `${decimalSep}${fraction}` : ""}`;
}

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

export function GovernanceView({
  snapshot,
  auditLimit = AUDIT_PAGE_SIZE,
  contractId,
}: {
  snapshot: GovernanceSnapshot | null;
  auditLimit?: number;
  contractId?: string;
}) {
  const t = useTranslations("governance");
  const locale = useLocale();
  const numberFormatter = new Intl.NumberFormat(locale);

  if (!snapshot) {
    return (
      <>
        <h1 className="mb-6 text-2xl font-bold">{t("heading")}</h1>
        <p className="text-sm text-gray-500">{t("notConfigured")}</p>
      </>
    );
  }

  const s = snapshot;
  const unavailable = <span className="text-red-600">{t("unavailable")}</span>;

  const renderField = <T,>(
    f: Field<T>,
    render: (value: T) => { text: ReactNode; raw?: string },
  ): { text: ReactNode; raw?: string } => (f.ok ? render(f.value) : { text: unavailable });

  const Val = <T,>({
    label,
    f,
    render,
  }: {
    label: string;
    f: Field<T>;
    render: (value: T) => { text: ReactNode; raw?: string };
  }) => {
    const { text, raw } = renderField(f, render);
    return <Row label={label} title={raw}>{text}</Row>;
  };

  const addressOf = (v: string | null) =>
    v === null
      ? { text: t("notSet") }
      : {
          text: (
            <a className="underline" href={explorerAccount(v)} target="_blank" rel="noreferrer">
              {shortenAddress(v)}
            </a>
          ),
          raw: v,
        };

  const bps = (v: number) => ({
    text: formatLocaleBps(v, locale),
    raw: t("bpsRaw", { value: numberFormatter.format(v) }),
  });

  const tokens = (v: bigint) => ({
    text: t("tokens", { amount: formatLocaleTokenAmount(v, locale) }),
    raw: v.toString(),
  });

  return (
    <>
      <h1 className="mb-6 text-2xl font-bold">{t("heading")}</h1>
      <div className="space-y-6">
        {contractId && (
          <p className="text-sm text-gray-500">
            {t("contract")}{" "}
            <a className="underline" href={explorer(contractId)} target="_blank" rel="noreferrer">
              {shortenAddress(contractId)}
            </a>
          </p>
        )}
        <div className="grid gap-4 md:grid-cols-2">
          <Card title={t("cards.roles")}>
            <Val label={t("fields.admin")} f={s.admin} render={addressOf} />
            <Val label={t("fields.guardian")} f={s.guardian} render={addressOf} />
          </Card>
          <Card title={t("cards.limits")}>
            <Val label={t("fields.minBorrow")} f={s.minBorrow} render={tokens} />
            <Val label={t("fields.depositCap")} f={s.depositCap} render={tokens} />
            <Val label={t("fields.borrowCap")} f={s.borrowCap} render={tokens} />
          </Card>
          <Card title={t("cards.liquidation")}>
            <Val label={t("fields.closeFactor")} f={s.closeFactorBps} render={bps} />
            <Val label={t("fields.liquidationThreshold")} f={s.liquidationThresholdBps} render={bps} />
            <Val label={t("fields.liquidationIncentive")} f={s.liquidationIncentiveBps} render={bps} />
          </Card>
          <Card title={t("cards.rateModel")}>
            {s.rateParams.ok ? (
              Object.entries(s.rateParams.value).map(([key, value]) => {
                const isBps = key.endsWith("_bps");
                const isSeconds = key.endsWith("_seconds") || key.endsWith("_secs");
                const text = isBps
                  ? formatLocaleBps(value, locale)
                  : isSeconds
                    ? formatDuration(value)
                    : numberFormatter.format(value);
                const rawTitle = isBps
                  ? t("bpsRaw", { value: numberFormatter.format(value) })
                  : value.toString();
                return <Row key={key} label={key} title={rawTitle}>{text}</Row>;
              })
            ) : (
              <Row label={t("fields.rateParameters")}>{unavailable}</Row>
            )}
          </Card>
          <Card title={t("cards.flashLoans")}>
            <Val label={t("fields.maxFlashLoan")} f={s.maxFlashBps} render={bps} />
          </Card>
          <Card title={t("cards.oracle")}>
            <Val label={t("fields.oracleKey")} f={s.oracle} render={addressOf} />
          </Card>
        </div>

        <section aria-label={t("audit.title")}>
          <div className="mb-2 flex items-baseline justify-between gap-4">
            <h2 className="text-lg font-semibold">{t("audit.title")}</h2>
            {s.audit.ok && s.audit.value.length > 0 && (
              <span className="text-sm text-gray-500">
                {t("audit.entryCount", { count: s.audit.value.length })}
              </span>
            )}
          </div>
          {!s.audit.ok ? (
            <p className="text-sm text-red-600">{t("unavailable")}</p>
          ) : s.audit.value.length === 0 ? (
            <p className="text-sm text-gray-500">{t("audit.empty")}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr>
                    <th scope="col" className="p-2">{t("audit.columns.sequence")}</th>
                    <th scope="col" className="p-2">{t("audit.columns.action")}</th>
                    <th scope="col" className="p-2">{t("audit.columns.actor")}</th>
                    <th scope="col" className="p-2">{t("audit.columns.ledger")}</th>
                    <th scope="col" className="p-2">{t("audit.columns.diffs")}</th>
                  </tr>
                </thead>
                <tbody>
                  {s.audit.value.map((e) => (
                    <tr key={e.sequence.toString()} className="border-t">
                      <td className="p-2">{numberFormatter.format(e.sequence)}</td>
                      <td className="p-2">{e.action}</td>
                      <td className="p-2">
                        <a
                          className="underline"
                          href={explorerAccount(e.actor)}
                          target="_blank"
                          rel="noreferrer"
                          title={e.actor}
                        >
                          {shortenAddress(e.actor)}
                        </a>
                      </td>
                      <td className="p-2">{numberFormatter.format(e.ledger)}</td>
                      <td className="p-2">
                        {e.diffs && e.diffs.length > 0 ? (
                          <ul className="space-y-1">
                            {e.diffs.map((d) => (
                              <li key={d.field} className="flex items-center gap-1.5 text-xs">
                                <span className="font-mono text-gray-600">{d.field}:</span>
                                <span>{d.prevFormatted} → {d.nextFormatted}</span>
                                {d.direction === "increase" && (
                                  <span className="inline-flex items-center text-green-700" title={t("audit.increase")}>
                                    <span aria-hidden="true">▲</span>
                                    <span className="ml-0.5 font-medium">(+ {t("audit.increase")})</span>
                                  </span>
                                )}
                                {d.direction === "decrease" && (
                                  <span className="inline-flex items-center text-amber-700" title={t("audit.decrease")}>
                                    <span aria-hidden="true">▼</span>
                                    <span className="ml-0.5 font-medium">(- {t("audit.decrease")})</span>
                                  </span>
                                )}
                                {d.direction === "unknown" && (
                                  <span className="inline-flex items-center text-gray-500" title={t("audit.unknown")}>
                                    <span className="font-medium">({t("audit.unknown")})</span>
                                  </span>
                                )}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {s.audit.value.length >= auditLimit && (
                <a className="mt-3 inline-block text-sm underline" href={`?audit=${auditLimit + AUDIT_PAGE_SIZE}`}>
                  {t("audit.showMore")}
                </a>
              )}
            </div>
          )}
        </section>
      </div>
    </>
  );
}
