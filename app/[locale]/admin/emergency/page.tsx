import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { EmergencyControls } from "@/components/admin/emergency-controls";
import { buildMetadata } from "@/lib/site";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "meta.adminEmergency" });

  return buildMetadata({
    locale,
    path: "/admin/emergency",
    title: t("title"),
    description: t("description"),
  });
}

export default async function AdminEmergencyLocalePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <EmergencyControls />;
}
