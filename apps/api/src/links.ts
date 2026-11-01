/** Short links: /s/<id> on the site opens a long share link. The same link always gets the same id. */
import { ApiError, type Env } from "./http";
import { randomId, sha256 } from "./identity";
import { MAX_PAYLOAD } from "./gallery";

/** Share links the site makes: a program for the simulator, or a machine for the designer. */
const SHAREABLE = /^\/(sim\?p=|machines\?m=)[A-Za-z0-9+$-]+$/;
const ID = /^[A-Za-z0-9]{7}$/;

export async function shorten(env: Env, path: unknown, now: number): Promise<{ id: string }> {
  if (typeof path !== "string" || !SHAREABLE.test(path)) {
    throw new ApiError(400, "Only share links from Joe's SIM can be shortened.");
  }
  if (path.length > MAX_PAYLOAD + 20) throw new ApiError(413, "That link is too long to shorten.");
  const hash = await sha256(path);
  const existing = await env.DB.prepare("SELECT id FROM links WHERE hash = ?1")
    .bind(hash)
    .first<{ id: string }>();
  if (existing) return { id: existing.id };
  const id = randomId(7);
  // Two people shortening the same link at once: the second insert changes nothing.
  await env.DB.prepare(
    "INSERT INTO links (id, path, hash, created) VALUES (?1, ?2, ?3, ?4) ON CONFLICT DO NOTHING",
  )
    .bind(id, path, hash, now)
    .run();
  const row = await env.DB.prepare("SELECT id FROM links WHERE hash = ?1")
    .bind(hash)
    .first<{ id: string }>();
  return { id: row?.id ?? id };
}

export async function resolve(env: Env, id: string): Promise<{ path: string }> {
  const row = ID.test(id)
    ? await env.DB.prepare("SELECT path FROM links WHERE id = ?1")
        .bind(id)
        .first<{ path: string }>()
    : null;
  if (!row) throw new ApiError(404, "That short link does not exist.");
  return { path: row.path };
}
