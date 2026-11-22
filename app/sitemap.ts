import type { MetadataRoute } from "next";
import { getSitemapEntries } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  return getSitemapEntries();
}
