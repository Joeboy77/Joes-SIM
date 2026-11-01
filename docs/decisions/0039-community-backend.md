# 0039: The community backend (Phase 11)

## Context

Phase 11 adds leaderboards, a public gallery and short share links. These are the only features
that need a server. The brief requires that they need no account, and that the simulator, lessons
and challenges keep working fully without them. The project owner chose Cloudflare for hosting.

## Options

- **Hosting:** API routes inside the Next.js app with SQLite; Vercel with Postgres; or Cloudflare
  Workers with D1.
- **Trusting scores:** accept the scores the browser reports, or run the program on the server.
- **Identity:** nickname only; nickname plus a password; or nickname plus a random key kept in the
  browser.

## Choice

- **Cloudflare Workers and D1**, in a separate app, [`apps/api`](../../apps/api/). The free tier and
  the edge network suit learners on slow connections, and keeping the backend separate means the
  site can be hosted anywhere.
- **The server runs every submitted program** with the same `runChallenge` the browser uses, so a
  score cannot be invented. The program is not stored, so solutions do not leak. Challenges whose
  program is fixed have no leaderboard.
- **A random key per browser**, stored only as a salted hash on the server. It lets a learner
  update and remove their own entries without an account. Nicknames are checked against a short
  word list. Gallery programs are hidden after 3 reports until a moderator looks at them, and a
  moderator token unlocks `/admin`.
- **Switched on by one setting.** The web app shows the leaderboard, the gallery link, short links
  and publishing only when built with `NEXT_PUBLIC_COMMUNITY_API`. Without it, the site is exactly
  as before. Nothing is sent until the learner asks: a challenge page loads its leaderboard only after **Show the leaderboard** is pressed, and viewing never creates a player key. When the API cannot be reached, each feature says so in a sentence, and nothing else
  is affected.
- **Tests run against real D1:**
  - Unit tests use Wrangler's local platform (Miniflare).
  - The browser tests start `wrangler dev` with a fresh local database next to the site.
  - The API's code coverage threshold is 95%, the same as the engine's.

## Consequences

- **CPU time.** Most solutions are checked in under 1 ms. `lock-the-counter`, a multicore challenge
  with race detection, takes about 40 ms. A slow but correct program can take longer. Workers on
  the free plan stop after 10 ms of CPU time, so the API should run on the **Workers Paid** plan
  (30 seconds of CPU per request).
- **Wrangler 4 needs Node.js 22.** CI already uses Node 22 (`.nvmrc`).
- **The player key is not in backups.** A learner who moves to a new device can still post scores
  and publish under a new key, but cannot change entries made from the old one.
- **The privacy page lists exactly what the community features store.**
