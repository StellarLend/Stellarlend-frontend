import Link from "next/link";
import { getTranslations } from "next-intl/server";

export default async function NotFound() {
  const t = await getTranslations("errors.notFound");

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <div className="card max-w-lg space-y-6 p-8">
        <div className="space-y-3">
          <p className="font-mono text-5xl font-extrabold text-blue-500">{"404"}</p>
          <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
          <p className="text-sm text-neutral-400">{t("description")}</p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <Link
            href="/markets"
            className="btn px-5 py-2.5 text-sm font-medium"
          >
            {t("goToMarkets")}
          </Link>
          <Link
            href="/docs"
            className="btn-ghost px-5 py-2.5 text-sm font-medium"
          >
            {t("goToDocs")}
          </Link>
          <Link
            href="/"
            className="btn-ghost px-5 py-2.5 text-sm font-medium"
          >
            {t("goHome")}
          </Link>
        </div>
      </div>
    </div>
  );
}
