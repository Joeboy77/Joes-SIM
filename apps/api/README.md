# @joes-sim/api: the optional community service

Leaderboards, the gallery and short links (Phase 11), on Cloudflare Workers with a D1 database.
The routes and rules are in [docs/specs/community-api.md](../../docs/specs/community-api.md).
Joe's SIM works fully without this service.

Wrangler, Cloudflare's command-line tool, needs **Node.js 22** or newer.

## Run it locally

```sh
pnpm --filter @joes-sim/api dev                 # http://localhost:8787, with a local database
NEXT_PUBLIC_COMMUNITY_API=http://localhost:8787 pnpm dev   # the site, with community features on
```

`pnpm --filter @joes-sim/api test` runs the tests against a fresh local D1 database.

## Deploy

1. **Create the database:** `pnpm --filter @joes-sim/api exec wrangler d1 create joes-sim`. Put the
   `database_id` it prints into `wrangler.toml`.
2. **Set the allowed sites:** in `wrangler.toml`, set `ALLOWED_ORIGINS` to the site's address, for
   example `https://joes-sim.example.org`.
3. **Set the two secrets.** For each, use a long random value.
   - `pnpm --filter @joes-sim/api exec wrangler secret put HASH_SALT`. Never change this salt later:
     changing it would detach every player from their entries.
   - `pnpm --filter @joes-sim/api exec wrangler secret put ADMIN_TOKEN`, for moderation.
4. **Deploy:** `pnpm --filter @joes-sim/api deploy`. This applies the migrations, then deploys the
   Worker.
5. **Point the site at it:** build the site with `NEXT_PUBLIC_COMMUNITY_API` set to the Worker's
   address, for example `https://joes-sim-api.<account>.workers.dev`.

Use the **Workers Paid** plan. The server runs each submitted program, and some challenges take
longer than the free plan's 10 ms CPU limit (decision 0039).

## Moderate

```sh
curl -H "Authorization: Bearer $ADMIN_TOKEN" https://<api>/admin/reported
curl -H "Authorization: Bearer $ADMIN_TOKEN" -H "content-type: application/json" \
  -d '{"kind":"program","id":"<id>","action":"keep"}' https://<api>/admin/moderate
```

The actions are:

- **Programs:** `hide`, `keep` (show it, and ignore further reports) or `delete`.
- **Leaderboard entries:** `hide` or `show`, by challenge and nickname.
