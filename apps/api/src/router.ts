/**
 * The API's routes (docs/specs/community-api.md). Every route is optional for the site: when the
 * API cannot be reached, the simulator, lessons and challenges carry on without it.
 */
import { CHALLENGES, hasLeaderboard } from "@joes-sim/content";
import { moderate, reported } from "./admin";
import { get, list, publish, remove, report } from "./gallery";
import { ApiError, corsHeaders, json, readBody, type Env } from "./http";
import { optionalPlayer, player, visitor } from "./identity";
import { limit } from "./limits";
import { resolve, shorten } from "./links";
import { board, measure, submit, withdraw } from "./scores";

type Handler = (
  request: Request,
  env: Env,
  params: readonly string[],
  now: number,
) => Promise<unknown>;

interface Route {
  readonly method: string;
  readonly pattern: RegExp;
  readonly handle: Handler;
}

const SEGMENT = "([A-Za-z0-9_-]{1,80})";

const routes: readonly Route[] = [
  { method: "GET", pattern: /^\/health$/, handle: async () => ({ ok: true }) },
  {
    method: "GET",
    pattern: /^\/challenges$/,
    // Which challenges have a leaderboard.
    handle: async () => ({ ranked: CHALLENGES.filter(hasLeaderboard).map((c) => c.id) }),
  },
  {
    method: "GET",
    pattern: new RegExp(`^/challenges/${SEGMENT}/scores$`),
    handle: async (request, env, [id = ""]) => {
      const url = new URL(request.url);
      const size = Math.min(50, Math.max(1, Number(url.searchParams.get("limit")) || 10));
      return board(
        env,
        id,
        measure(url.searchParams.get("by")),
        await optionalPlayer(env, request),
        size,
      );
    },
  },
  {
    method: "POST",
    pattern: new RegExp(`^/challenges/${SEGMENT}/scores$`),
    handle: async (request, env, [id = ""], now) => {
      const body = await readBody(request);
      const me = await player(env, body.key);
      await limit(env, "score", await visitor(env, request), now);
      return submit(env, id, body, me, now);
    },
  },
  {
    method: "DELETE",
    pattern: new RegExp(`^/challenges/${SEGMENT}/scores$`),
    handle: async (request, env, [id = ""]) => {
      await withdraw(env, id, await player(env, request.headers.get("x-player-key")));
      return { deleted: true };
    },
  },
  {
    method: "GET",
    pattern: /^\/programs$/,
    handle: async (request, env) => {
      const url = new URL(request.url);
      return list(env, await optionalPlayer(env, request), {
        machine: url.searchParams.get("machine"),
        before: url.searchParams.get("before"),
      });
    },
  },
  {
    method: "POST",
    pattern: /^\/programs$/,
    handle: async (request, env, _, now) => {
      const body = await readBody(request);
      const me = await player(env, body.key);
      await limit(env, "publish", await visitor(env, request), now);
      return publish(env, body, me, now);
    },
  },
  {
    method: "GET",
    pattern: new RegExp(`^/programs/${SEGMENT}$`),
    handle: async (request, env, [id = ""]) => get(env, id, await optionalPlayer(env, request)),
  },
  {
    method: "DELETE",
    pattern: new RegExp(`^/programs/${SEGMENT}$`),
    handle: async (request, env, [id = ""]) => {
      await remove(env, id, await player(env, request.headers.get("x-player-key")));
      return { deleted: true };
    },
  },
  {
    method: "POST",
    pattern: new RegExp(`^/programs/${SEGMENT}/report$`),
    handle: async (request, env, [id = ""], now) => {
      const body = await readBody(request);
      const who = await visitor(env, request);
      await limit(env, "report", who, now);
      return report(env, id, body, who, now);
    },
  },
  {
    method: "POST",
    pattern: /^\/links$/,
    handle: async (request, env, _, now) => {
      const body = await readBody(request);
      await limit(env, "link", await visitor(env, request), now);
      return shorten(env, body.path, now);
    },
  },
  {
    method: "GET",
    pattern: new RegExp(`^/links/${SEGMENT}$`),
    handle: async (_, env, [id = ""]) => resolve(env, id),
  },
  {
    method: "GET",
    pattern: /^\/admin\/reported$/,
    handle: (request, env) => reported(request, env),
  },
  {
    method: "POST",
    pattern: /^\/admin\/moderate$/,
    handle: (request, env) => moderate(request, env),
  },
];

export async function handle(request: Request, env: Env, now = Date.now()): Promise<Response> {
  const cors = corsHeaders(request, env);
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  const { pathname } = new URL(request.url);
  const matching = routes.filter((r) => r.pattern.test(pathname));
  const route = matching.find((r) => r.method === request.method);
  try {
    if (!route) {
      throw matching.length
        ? new ApiError(405, "That method is not allowed here.")
        : new ApiError(404, "Not found.");
    }
    const params = route.pattern.exec(pathname)?.slice(1) ?? [];
    const body = await route.handle(request, env, params, now);
    // Lists change often; nothing is worth caching for long.
    return json(body, 200, { ...cors, "cache-control": "no-store" });
  } catch (e) {
    if (e instanceof ApiError) return json({ error: e.message, ...e.extra }, e.status, cors);
    console.error(e);
    return json({ error: "Something went wrong on the server." }, 500, cors);
  }
}
