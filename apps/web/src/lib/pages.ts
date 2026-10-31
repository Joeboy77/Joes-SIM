import { CHALLENGES } from "@joes-sim/content";
import { LESSONS } from "@/lessons/catalogue";

/** Pages for search engines. */
export const PUBLIC_PAGES: readonly string[] = [
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

/** Every page the app needs offline: the public pages, plus the ones search engines skip. */
export const OFFLINE_PAGES: readonly string[] = [
  ...PUBLIC_PAGES,
  "/progress",
  "/packs/view",
  "/packs/edit",
  "/embed",
];
