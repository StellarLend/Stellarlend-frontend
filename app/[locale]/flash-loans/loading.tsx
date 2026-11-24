import { getTranslations } from "next-intl/server";
import { Skeleton } from "@/components/ui";

export default async function FlashLoansLoading({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "common" });

  return (
    <Skeleton label={t("loading")} className="mx-auto max-w-6xl px-4 py-10">
      <div>
        <Skeleton className="h-9 w-56" />
        <Skeleton className="mt-2 h-4 w-96 max-w-full" />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card space-y-4 p-5">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="card space-y-4 p-5">
          <Skeleton className="h-5 w-28" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-8 w-40" />
        </div>
      </div>
    </Skeleton>
  );
}
