import { getTranslations } from "next-intl/server";
import { Skeleton } from "@/components/ui";
import { defaultLocale } from "@/i18n/routing";

export default async function MarketsLoading() {
  const t = await getTranslations({ locale: defaultLocale, namespace: "common" });

  return (
    <Skeleton label={t("loading")}>
      <div>
        <Skeleton className="h-9 w-48" />
        <Skeleton className="mt-2 h-4 w-96 max-w-full" />
      </div>

      <div className="card flex flex-wrap items-center justify-between gap-4 p-5">
        <div className="space-y-2">
          <Skeleton className="h-3.5 w-16" />
          <Skeleton className="h-5 w-44" />
        </div>
        <div className="grid grid-cols-3 gap-6">
          {[1, 2, 3].map((item) => (
            <div key={item} className="space-y-1.5">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-5 w-20" />
            </div>
          ))}
        </div>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="mut">
            <tr className="border-b border-[var(--line)]">
              <th className="p-4">
                <Skeleton className="h-4 w-16" />
              </th>
              <th className="p-4">
                <Skeleton className="h-4 w-12" />
              </th>
              <th className="p-4">
                <Skeleton className="h-4 w-20" />
              </th>
              <th className="p-4">
                <Skeleton className="h-4 w-20" />
              </th>
              <th className="p-4">
                <Skeleton className="h-4 w-24" />
              </th>
              <th className="p-4">
                <Skeleton className="h-4 w-24" />
              </th>
              <th className="p-4">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {[1, 2, 3, 4].map((row) => (
              <tr key={row} className="border-b border-[var(--line)] last:border-0">
                <td className="p-4">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-4 w-12" />
                    <Skeleton className="h-3.5 w-24" />
                  </div>
                </td>
                <td className="p-4">
                  <Skeleton className="h-4 w-16" />
                </td>
                <td className="p-4">
                  <Skeleton className="h-4 w-14" />
                </td>
                <td className="p-4">
                  <Skeleton className="h-4 w-14" />
                </td>
                <td className="p-4">
                  <Skeleton className="h-4 w-20" />
                </td>
                <td className="p-4">
                  <Skeleton className="h-4 w-28" />
                </td>
                <td className="p-4 text-right">
                  <Skeleton className="inline-block h-8 w-16" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Skeleton>
  );
}
