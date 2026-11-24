import { getTranslations } from "next-intl/server";
import { Skeleton } from "@/components/ui";

export default async function AmmLoading({
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
        <Skeleton className="mt-2 h-4 w-80 max-w-full" />
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="card space-y-4 p-5">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-10 w-28" />
        </div>
        <div className="card space-y-4 p-5">
          <Skeleton className="h-5 w-28" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
        <div className="card space-y-4 p-5">
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-48 w-full" />
        </div>
      </div>
    </Skeleton>
  );
}
