/** Rate limits per visitor, counted in D1 so they hold across every Worker instance. */
import { ApiError, type Env } from "./http";

export const LIMITS = {
  score: { max: 30, windowMs: 60 * 60 * 1000 },
  publish: { max: 10, windowMs: 60 * 60 * 1000 },
  link: { max: 60, windowMs: 60 * 60 * 1000 },
  report: { max: 20, windowMs: 60 * 60 * 1000 },
} as const;

export type Action = keyof typeof LIMITS;

/** Counts one use of an action; refuses once the visitor has used up the window. */
export async function limit(env: Env, action: Action, visitor: string, now: number) {
  const { max, windowMs } = LIMITS[action];
  const window = Math.floor(now / windowMs);
  const row = await env.DB.prepare(
    `INSERT INTO hits (bucket, count, expires) VALUES (?1, 1, ?2)
     ON CONFLICT (bucket) DO UPDATE SET count = count + 1
     RETURNING count`,
  )
    .bind(`${action}:${visitor}:${window}`, (window + 1) * windowMs)
    .first<{ count: number }>();
  if ((row?.count ?? 0) > max) {
    const minutes = Math.ceil(((window + 1) * windowMs - now) / 60_000);
    throw new ApiError(429, `Too many at once. Please try again in ${minutes} minutes.`, {
      retryAfterMinutes: minutes,
    });
  }
}

/** Deletes counters whose window has passed. Run daily by the cron trigger. */
export async function sweep(env: Env, now: number): Promise<number> {
  const r = await env.DB.prepare("DELETE FROM hits WHERE expires <= ?1").bind(now).run();
  return r.meta.changes;
}
