/**
 * Challenge leaderboards. A score is accepted only after the server runs the program against
 * the challenge's tests itself, with the same code the browser uses; the program is then
 * thrown away, so solutions never become public.
 */
import {
  CHALLENGES,
  hasLeaderboard,
  runChallenge,
  type Challenge,
  type Targets,
} from "@joes-sim/content";
import { ApiError, text, type Env } from "./http";
import { nickname } from "./names";

export const MEASURES = ["instructions", "cycles", "mailboxes"] as const;
export type Measure = (typeof MEASURES)[number];

export const MAX_SOURCE = 20_000;

function find(id: string): Challenge {
  const challenge = CHALLENGES.find((c) => c.id === id);
  if (!challenge) throw new ApiError(404, "There is no challenge with that name.");
  if (!hasLeaderboard(challenge)) {
    throw new ApiError(404, "This challenge has no leaderboard: everyone's program is the same.");
  }
  return challenge;
}

export interface Entry {
  readonly rank: number;
  readonly nickname: string;
  readonly score: number;
  readonly mine: boolean;
}

export interface Board {
  readonly challenge: string;
  readonly by: Measure;
  readonly entries: readonly Entry[];
  /** The player's own place, when they have one (even outside the top entries). */
  readonly mine: { readonly rank: number; readonly score: number } | null;
  readonly players: number;
}

export function measure(value: string | null): Measure {
  if (value === null) return "instructions";
  if (!(MEASURES as readonly string[]).includes(value)) {
    throw new ApiError(400, "Sort by instructions, cycles or mailboxes.");
  }
  return value as Measure;
}

export async function board(
  env: Env,
  id: string,
  by: Measure,
  me: string | null,
  size = 10,
): Promise<Board> {
  find(id);
  // `by` is one of three fixed column names, never text from the request.
  const rows = await env.DB.prepare(
    `SELECT nickname, ${by} AS score, player FROM scores
     WHERE challenge = ?1 AND hidden = 0
     ORDER BY ${by}, ${by}_at LIMIT ?2`,
  )
    .bind(id, size)
    .all<{ nickname: string; score: number; player: string }>();
  // Equal scores share a rank; the earlier one is listed first.
  const entries: Entry[] = [];
  rows.results.forEach((r, i) => {
    const prev = entries[i - 1];
    entries.push({
      rank: prev && prev.score === r.score ? prev.rank : i + 1,
      nickname: r.nickname,
      score: r.score,
      mine: r.player === me,
    });
  });
  const count = await env.DB.prepare(
    "SELECT COUNT(*) AS n FROM scores WHERE challenge = ?1 AND hidden = 0",
  )
    .bind(id)
    .first<{ n: number }>();
  let mine: Board["mine"] = null;
  if (me) {
    const own = await env.DB.prepare(
      `SELECT ${by} AS score FROM scores WHERE challenge = ?1 AND player = ?2 AND hidden = 0`,
    )
      .bind(id, me)
      .first<{ score: number }>();
    if (own) {
      const better = await env.DB.prepare(
        `SELECT COUNT(*) AS n FROM scores WHERE challenge = ?1 AND hidden = 0 AND ${by} < ?2`,
      )
        .bind(id, own.score)
        .first<{ n: number }>();
      mine = { rank: (better?.n ?? 0) + 1, score: own.score };
    }
  }
  return { challenge: id, by, entries, mine, players: count?.n ?? 0 };
}

export interface Submitted {
  readonly scores: Targets;
  /** The player's best on each measure, after this submission. */
  readonly best: Targets;
}

export async function submit(
  env: Env,
  id: string,
  body: Record<string, unknown>,
  me: string,
  now: number,
): Promise<Submitted> {
  const challenge = find(id);
  const name = nickname(body);
  const source = text(body, "source", { max: MAX_SOURCE, label: "The program" });
  const result = runChallenge(source, challenge);
  if (!result.passed || !result.scores) {
    const failed = result.errors.length
      ? "The program does not assemble."
      : `${result.results.filter((r) => !r.pass).length} of ${result.results.length} tests fail.`;
    throw new ApiError(
      422,
      `Only programs that pass every test can go on the leaderboard. ${failed}`,
    );
  }
  const s = result.scores;
  // Keep each best on its own; its time changes only when it improves.
  await env.DB.prepare(
    `INSERT INTO scores (challenge, player, nickname,
       instructions, instructions_at, cycles, cycles_at, mailboxes, mailboxes_at)
     VALUES (?1, ?2, ?3, ?4, ?7, ?5, ?7, ?6, ?7)
     ON CONFLICT (challenge, player) DO UPDATE SET
       nickname = excluded.nickname,
       instructions_at = CASE WHEN excluded.instructions < instructions THEN ?7 ELSE instructions_at END,
       instructions = MIN(instructions, excluded.instructions),
       cycles_at = CASE WHEN excluded.cycles < cycles THEN ?7 ELSE cycles_at END,
       cycles = MIN(cycles, excluded.cycles),
       mailboxes_at = CASE WHEN excluded.mailboxes < mailboxes THEN ?7 ELSE mailboxes_at END,
       mailboxes = MIN(mailboxes, excluded.mailboxes)`,
  )
    .bind(id, me, name, s.instructions, s.cycles, s.mailboxes, now)
    .run();
  const best = await env.DB.prepare(
    "SELECT instructions, cycles, mailboxes FROM scores WHERE challenge = ?1 AND player = ?2",
  )
    .bind(id, me)
    .first<Targets>();
  return { scores: s, best: best ?? s };
}

/** Takes the player's entry off a leaderboard. */
export async function withdraw(env: Env, id: string, me: string): Promise<void> {
  find(id);
  await env.DB.prepare("DELETE FROM scores WHERE challenge = ?1 AND player = ?2")
    .bind(id, me)
    .run();
}
