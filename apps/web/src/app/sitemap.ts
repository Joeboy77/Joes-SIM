import type { MetadataRoute } from "next";
import { PUBLIC_PAGES } from "@/lib/pages";
import { SITE_URL } from "@/lib/site";

/** Every page that should appear in search results. */
export default function sitemap(): MetadataRoute.Sitemap {
  return PUBLIC_PAGES.map((p) => ({ url: `${SITE_URL}${p}` }));
}
