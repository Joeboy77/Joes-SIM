/**
 * The public gallery: programs that learners chose to publish. A program is kept as its share
 * payload, so opening one works exactly like opening a share link.
 */
import { decompressFromEncodedURIComponent } from "lz-string";
import { ApiError, text, type Env } from "./http";
import { randomId } from "./identity";
import { clean, nickname } from "./names";

/** Reports from this many visitors hide a program until a moderator looks at it. */
export const REPORTS_TO_HIDE = 3;
export const PAGE = 24;
export const MACHINES = ["classic", "extended", "multicore"] as const;
export type GalleryMachine = (typeof MACHINES)[number];

/** The longest share payload accepted, about 20,000 characters of program. */
export const MAX_PAYLOAD = 16_000;

export interface Published {
  readonly id: string;
  readonly nickname: string;
  readonly title: string;
  readonly description: string;
  readonly machine: GalleryMachine;
  readonly p: string;
  readonly created: number;
  readonly mine: boolean;
}

interface Row {
  id: string;
  player: string;
  nickname: string;
  title: string;
  description: string;
  machine: GalleryMachine;
  p: string;
  created: number;
}

const shown = (r: Row, me: string | null): Published => ({
  id: r.id,
  nickname: r.nickname,
  title: r.title,
  description: r.description,
  machine: r.machine,
  p: r.p,
  created: r.created,
  mine: r.player === me,
});

/**
 * Checks a share payload (the `p` of /sim?p=...) the way the simulator reads it, and returns
 * which machine it is for.
 */
export function readPayload(p: unknown): GalleryMachine {
  const bad = new ApiError(400, "The program could not be read.");
  if (typeof p !== "string" || !p) throw bad;
  if (p.length > MAX_PAYLOAD) throw new ApiError(413, "The program is too long to publish.");
  let wire: unknown;
  try {
    wire = JSON.parse(decompressFromEncodedURIComponent(p) ?? "");
  } catch {
    throw bad;
  }
  if (typeof wire !== "object" || wire === null) throw bad;
  const w = wire as { v?: unknown; s?: unknown; d?: unknown; m?: unknown };
  if (w.v !== 1 || typeof w.s !== "string" || typeof w.d !== "string" || !w.s.trim()) throw bad;
  return w.m === "e" ? "extended" : w.m === "m" ? "multicore" : "classic";
}

export async function publish(
  env: Env,
  body: Record<string, unknown>,
  me: string,
  now: number,
): Promise<{ id: string }> {
  const name = nickname(body);
  const title = clean(text(body, "title", { max: 80, label: "The title" }), "title");
  const description = clean(
    text(body, "description", { min: 0, max: 500, label: "The description" }),
    "description",
  );
  const machine = readPayload(body.p);
  const id = randomId(8);
  await env.DB.prepare(
    `INSERT INTO programs (id, player, nickname, title, description, machine, p, created)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`,
  )
    .bind(id, me, name, title, description, machine, body.p, now)
    .run();
  return { id };
}

/** Newest first, a page at a time; `before` is the `next` value of the page before. */
export async function list(
  env: Env,
  me: string | null,
  options: { machine: string | null; before: string | null },
): Promise<{ programs: Published[]; next: string | null }> {
  const machine = options.machine;
  if (machine !== null && !(MACHINES as readonly string[]).includes(machine)) {
    throw new ApiError(400, "Choose the classic, extended or multicore machine.");
  }
  // The cursor is "<created>.<id>", so programs published in the same millisecond are not skipped.
  const [time = String(Number.MAX_SAFE_INTEGER), after = ""] = (options.before ?? "").split(".");
  const created = Number(time || Number.MAX_SAFE_INTEGER);
  if (!Number.isFinite(created)) throw new ApiError(400, "The page is not valid.");
  const rows = await env.DB.prepare(
    `SELECT * FROM programs
     WHERE hidden = 0 AND (?2 IS NULL OR machine = ?2)
       AND (created < ?1 OR (created = ?1 AND ?4 <> '' AND id < ?4))
     ORDER BY created DESC, id DESC LIMIT ?3`,
  )
    .bind(created, machine, PAGE + 1, after)
    .all<Row>();
  const page = rows.results.slice(0, PAGE);
  const last = page.at(-1);
  return {
    programs: page.map((r) => shown(r, me)),
    next: rows.results.length > PAGE && last ? `${last.created}.${last.id}` : null,
  };
}

export async function get(env: Env, id: string, me: string | null): Promise<Published> {
  const row = await env.DB.prepare("SELECT * FROM programs WHERE id = ?1 AND hidden = 0")
    .bind(id)
    .first<Row>();
  if (!row) throw new ApiError(404, "That program is not in the gallery.");
  return shown(row, me);
}

/** Only the player who published a program can take it down. */
export async function remove(env: Env, id: string, me: string): Promise<void> {
  const r = await env.DB.prepare("DELETE FROM programs WHERE id = ?1 AND player = ?2")
    .bind(id, me)
    .run();
  if (r.meta.changes === 0) {
    throw new ApiError(404, "That program is not in the gallery, or it was published elsewhere.");
  }
  await env.DB.prepare("DELETE FROM reports WHERE program = ?1").bind(id).run();
}

export async function report(
  env: Env,
  id: string,
  body: Record<string, unknown>,
  visitor: string,
  now: number,
): Promise<{ hidden: boolean }> {
  const reason = text(body, "reason", { min: 0, max: 300, label: "The reason" });
  await get(env, id, null);
  const added = await env.DB.prepare(
    `INSERT INTO reports (program, visitor, reason, created) VALUES (?1, ?2, ?3, ?4)
     ON CONFLICT DO NOTHING`,
  )
    .bind(id, visitor, reason, now)
    .run();
  if (added.meta.changes === 0) return { hidden: false };
  const row = await env.DB.prepare(
    `UPDATE programs SET reports = reports + 1,
       hidden = CASE WHEN reviewed = 0 AND reports + 1 >= ?2 THEN 1 ELSE hidden END
     WHERE id = ?1 RETURNING hidden`,
  )
    .bind(id, REPORTS_TO_HIDE)
    .first<{ hidden: number }>();
  return { hidden: row?.hidden === 1 };
}
