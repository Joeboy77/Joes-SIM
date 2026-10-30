# 0026: Working offline (first step)

## Context

Phase 4's acceptance criteria include restoring all work and progress offline. Full offline
support (every page, updates, installing the app) is Phase 5.

## Choice

A small service worker, `apps/web/public/sw.js`, registered in production builds only:

- When it installs, it caches the home, simulator, lessons, challenges and progress pages, and
  every build file those pages refer to.
- Build files (which have content hashes in their names) come from the cache first. Pages come
  from the network first, and from the cache when offline.
- It caches only this site's own files.

Work and progress are already in IndexedDB, so with these pages cached the simulator and the
Progress page open offline with everything restored. A browser test checks this.

## Not yet

A lesson or challenge page opens offline only after it has been visited once online. Phase 5
will cache every page in advance and handle updates.
