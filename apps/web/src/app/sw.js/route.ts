import { OFFLINE_PAGES } from "@/lib/pages";

export const dynamic = "force-static";

// Built once per build, so every deploy has a new version and browsers notice the update.
const VERSION = Date.now().toString(36);
const EXTRA = [
  "/joes-sim.js",
  "/manifest.webmanifest",
  "/icon-192.png",
  "/icon-512.png",
  "/icon-maskable.png",
];

/**
 * The service worker. When it installs it caches every page and every build file those pages
 * use, so after one visit the whole app works offline. Pages come from the network when there is
 * one; build files (whose names change when they change) come from the cache first. A new
 * version waits until the learner chooses to reload, so nothing changes under them.
 * Only this site's own files are cached; nothing is sent anywhere.
 */
const SOURCE = `
const VERSION = ${JSON.stringify(VERSION)};
const CACHE = "joes-sim-" + VERSION;
const PAGES = ${JSON.stringify(OFFLINE_PAGES)};
const EXTRA = ${JSON.stringify(EXTRA)};

async function cachePage(cache, url, seen) {
  const response = await fetch(url, { cache: "no-cache" });
  if (!response.ok) return;
  await cache.put(url, response.clone());
  const html = await response.text();
  const assets = html.match(/\\/_next\\/static\\/[^"'\\s)\\\\]+/g) || [];
  for (const a of assets) {
    if (seen.has(a)) continue;
    seen.add(a);
    try {
      const r = await fetch(a);
      if (r.ok) await cache.put(a, r);
    } catch (e) {}
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    const seen = new Set();
    for (const url of EXTRA) {
      try { const r = await fetch(url); if (r.ok) await cache.put(url, r); } catch (e) {}
    }
    for (const page of PAGES) {
      try { await cachePage(cache, page, seen); } catch (e) {}
    }
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k.startsWith("joes-sim") && k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
  if (event.data && event.data.type === "VERSION") event.source && event.source.postMessage({ type: "VERSION", version: VERSION });
});

function store(request, response) {
  if (response.ok && response.type === "basic") {
    const copy = response.clone();
    caches.open(CACHE).then((c) => c.put(request, copy));
  }
  return response;
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;
  if (url.pathname === "/sw.js" || url.pathname === "/og") return;

  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(caches.match(request).then((hit) => hit || fetch(request).then((r) => store(request, r))));
    return;
  }

  event.respondWith(
    fetch(request)
      .then((r) => store(request, r))
      .catch(async () => {
        const hit = await caches.match(request);
        if (hit) return hit;
        if (request.mode === "navigate" || request.headers.get("accept")?.includes("text/html")) {
          const page = await caches.match(url.pathname);
          if (page) return page;
        }
        return Response.error();
      }),
  );
});
`;

export function GET() {
  return new Response(SOURCE, {
    headers: {
      "content-type": "text/javascript; charset=utf-8",
      "cache-control": "no-cache",
      "service-worker-allowed": "/",
    },
  });
}
