/**
 * The optional community service (Phase 11): leaderboards, the gallery and short links. It is
 * switched on only when NEXT_PUBLIC_COMMUNITY_API is set at build time. Everything else in
 * Joe's SIM works without it, and the parts that use it say so plainly when it cannot be reached.
 */
import type { Targets } from "@joes-sim/content";

export const COMMUNITY_API = (process.env.NEXT_PUBLIC_COMMUNITY_API ?? "").replace(/\/+$/, "");
export const communityOn = COMMUNITY_API !== "";

export class CommunityError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

/** Long enough for the server to check a slow program, short enough not to leave people waiting. */
const TIMEOUT_MS = 15_000;

async function call<T>(
  method: string,
  path: string,
  options: { body?: unknown; key?: string | undefined; base?: string } = {},
): Promise<T> {
  const headers: Record<string, string> = {};
  if (options.body !== undefined) headers["content-type"] = "application/json";
  if (options.key) headers["x-player-key"] = options.key;
  let response: Response;
  try {
    response = await fetch(`${options.base ?? COMMUNITY_API}${path}`, {
      method,
      headers,
      ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    throw new CommunityError(
      typeof navigator !== "undefined" && navigator.onLine === false
        ? "You are offline. This needs an internet connection; everything else still works."
        : "The community service could not be reached. Please try again later.",
      0,
    );
  }
  const data = (await response.json().catch(() => ({}))) as { error?: string };
  if (!response.ok) {
    throw new CommunityError(
      data.error ?? "Something went wrong. Please try again.",
      response.status,
    );
  }
  return data as T;
}

// ---- Who you are, without an account ----

export interface Player {
  /** A random key made by this browser. Only its hash is kept on the server. */
  readonly key: string;
  readonly nickname: string;
}

const PLAYER = "joes-sim:player";

function newKey(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/** This browser's player, if it has used a community feature before. Never makes one. */
export function savedPlayer(): Player | null {
  try {
    const saved = JSON.parse(localStorage.getItem(PLAYER) ?? "null") as Partial<Player> | null;
    if (saved && typeof saved.key === "string" && saved.key.length >= 32) {
      return { key: saved.key, nickname: typeof saved.nickname === "string" ? saved.nickname : "" };
    }
  } catch {
    // Unreadable or switched off: there is no player yet.
  }
  return null;
}

/** This browser's player, made the first time the learner posts or publishes something. */
export function getPlayer(): Player {
  const saved = savedPlayer();
  if (saved) return saved;
  const player = { key: newKey(), nickname: "" };
  savePlayer(player);
  return player;
}

export function savePlayer(player: Player): void {
  try {
    localStorage.setItem(PLAYER, JSON.stringify(player));
  } catch {
    // Storage is off (a private window, say): the key lasts until the page closes.
  }
}

export function rememberNickname(nickname: string): Player {
  const player = { ...getPlayer(), nickname };
  savePlayer(player);
  return player;
}

// ---- Leaderboards ----

export const MEASURES = ["instructions", "cycles", "mailboxes"] as const;
export type Measure = (typeof MEASURES)[number];

export interface Board {
  readonly by: Measure;
  readonly entries: readonly {
    readonly rank: number;
    readonly nickname: string;
    readonly score: number;
    readonly mine: boolean;
  }[];
  readonly mine: { readonly rank: number; readonly score: number } | null;
  readonly players: number;
}

export const leaderboard = (challenge: string, by: Measure) =>
  call<Board>("GET", `/challenges/${encodeURIComponent(challenge)}/scores?by=${by}`, {
    key: savedPlayer()?.key,
  });

export const postScore = (challenge: string, nickname: string, source: string) =>
  call<{ scores: Targets; best: Targets }>(
    "POST",
    `/challenges/${encodeURIComponent(challenge)}/scores`,
    { body: { key: rememberNickname(nickname).key, nickname, source } },
  );

export const removeScore = (challenge: string) =>
  call<{ deleted: true }>("DELETE", `/challenges/${encodeURIComponent(challenge)}/scores`, {
    key: getPlayer().key,
  });

// ---- The gallery ----

export type GalleryMachine = "classic" | "extended" | "multicore";

export interface Published {
  readonly id: string;
  readonly nickname: string;
  readonly title: string;
  readonly description: string;
  readonly machine: GalleryMachine;
  /** The share payload: open it with /sim?p=... */
  readonly p: string;
  readonly created: number;
  readonly mine: boolean;
}

export function listPrograms(machine: GalleryMachine | null, before: string | null) {
  const query = new URLSearchParams();
  if (machine) query.set("machine", machine);
  if (before) query.set("before", before);
  const q = query.toString();
  return call<{ programs: Published[]; next: string | null }>(
    "GET",
    `/programs${q ? `?${q}` : ""}`,
    { key: savedPlayer()?.key },
  );
}

export const publishProgram = (p: {
  nickname: string;
  title: string;
  description: string;
  payload: string;
}) =>
  call<{ id: string }>("POST", "/programs", {
    body: {
      key: rememberNickname(p.nickname).key,
      nickname: p.nickname,
      title: p.title,
      description: p.description,
      p: p.payload,
    },
  });

export const deleteProgram = (id: string) =>
  call<{ deleted: true }>("DELETE", `/programs/${encodeURIComponent(id)}`, {
    key: getPlayer().key,
  });

export const reportProgram = (id: string, reason: string) =>
  call<{ hidden: boolean }>("POST", `/programs/${encodeURIComponent(id)}/report`, {
    body: { reason },
  });

// ---- Short links ----

/** Shortens a share path such as /sim?p=...; the short link is /s/<id> on this site. */
export const shortenLink = (path: string) =>
  call<{ id: string }>("POST", "/links", { body: { path } });

/** On the server: where a short link goes, or null if it does not exist or cannot be checked. */
export async function resolveLink(id: string, base = COMMUNITY_API): Promise<string | null> {
  if (!base || !/^[A-Za-z0-9]{7}$/.test(id)) return null;
  try {
    return (await call<{ path: string }>("GET", `/links/${id}`, { base })).path;
  } catch {
    return null;
  }
}
