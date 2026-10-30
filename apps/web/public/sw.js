/*
 * Joe's SIM offline support. Pages are fetched from the network when there is one, and from the
 * cache when there is not. Build files have content hashes in their names, so they are served
 * from the cache first. Only this site's own files are ever cached; nothing is sent anywhere.
 */
const CACHE = "joes-sim-v1";
const PAGES = ["/", "/sim", "/learn", "/challenges", "/progress"];

/** Caches a page and every build file it refers to, so it works offline straight away. */
async function cachePage(cache, url) {
  const response = await fetch(url, { cache: "no-cache" });
  if (!response.ok) return;
  await cache.put(url, response.clone());
  const html = await response.text();
  const assets = new Set(html.match(/\/_next\/static\/[^"'\s)]+/g) ?? []);
  await Promise.all(
    [...assets].map((a) =>
      fetch(a)
        .then((r) => (r.ok ? cache.put(a, r) : undefined))
        .catch(() => undefined),
    ),
  );
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => Promise.all(PAGES.map((p) => cachePage(cache, p).catch(() => undefined))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ??
          fetch(request).then((r) => {
            if (r.ok) {
              const copy = r.clone();
              void caches.open(CACHE).then((c) => c.put(request, copy));
            }
            return r;
          }),
      ),
    );
    return;
  }

  // Pages and everything else: the network first, the cache when offline.
  event.respondWith(
    fetch(request)
      .then((r) => {
        if (r.ok) {
          const copy = r.clone();
          void caches.open(CACHE).then((c) => c.put(request, copy));
        }
        return r;
      })
      .catch(async () => {
        const hit = await caches.match(request, { ignoreSearch: request.mode === "navigate" });
        if (hit) return hit;
        if (request.mode === "navigate") {
          const page = await caches.match(url.pathname);
          if (page) return page;
        }
        return Response.error();
      }),
  );
});
