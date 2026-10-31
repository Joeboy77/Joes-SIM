# 0032: The public site and search

## Choice

- Pages: home, instruction reference (built from the dialect definitions, so it cannot disagree
  with the engine), docs (getting started, embedding, packs, sharing, offline), about, privacy
  and contribute. Docs pages are MDX.
- Every page has a title and description; lesson and challenge pages are static HTML.
  `sitemap.xml` lists every public page and `robots.txt` keeps search engines out of `/embed`,
  `/og` and the pack editor.
- The privacy page says only what is true for Joe's SIM itself: no accounts, no tracking, no
  analytics, work kept in the browser. It notes that the hosting service may keep standard
  server logs.
