import { getTranslations } from "next-intl/server";
import { Skeleton } from "@/components/ui";

export default async function HistoryLoading({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "common" });

  return (
    <Skeleton label={t("loading")} className="mx-auto max-w-6xl px-4 py-10">
      <div>
        <Skeleton className="h-9 w-48" />
        <Skeleton className="mt-2 h-4 w-96 max-w-full" />
      </div>
      <div className="card overflow-hidden">
        {[1, 2, 3, 4, 5].map((row) => (
          <div
            key={row}
            className="flex items-center gap-6 border-b border-[var(--line)] p-4 last:border-0"
          >
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="ml-auto h-4 w-16" />
          </div>
        ))}
      </div>
    </Skeleton>
  );
}
