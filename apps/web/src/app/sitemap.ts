import { CHALLENGES } from "@joes-sim/content";
import type { MetadataRoute } from "next";
import { LESSONS } from "@/lessons/catalogue";
import { SITE_URL } from "@/lib/site";

/** Every page that should appear in search results. */
export default function sitemap(): MetadataRoute.Sitemap {
  const pages = [
    "/",
    "/sim",
    "/learn",
    "/challenges",
    "/packs",
    "/reference",
    "/docs",
    "/docs/getting-started",
    "/docs/embed",
    "/docs/packs",
    "/docs/sharing",
    "/docs/offline",
    "/about",
    "/privacy",
    "/contribute",
    ...LESSONS.map((l) => `/learn/${l.slug}`),
    ...CHALLENGES.map((c) => `/challenges/${c.id}`),
  ];
  return pages.map((p) => ({ url: `${SITE_URL}${p}` }));
}
