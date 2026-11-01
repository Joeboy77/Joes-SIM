import { compressToEncodedURIComponent } from "lz-string";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { REPORTS_TO_HIDE } from "./gallery";
import type { Env } from "./http";
import { randomId } from "./identity";
import { LIMITS, sweep } from "./limits";
import { isOffensive } from "./names";
import { handle } from "./router";
import { testEnv } from "./test-db";
import worker from "./worker";

let env: Env;
let dispose: () => Promise<void>;
beforeAll(async () => {
  ({ env, dispose } = await testEnv());
});
afterAll(() => dispose());

const ALICE = "a".repeat(40);
const BOB = "b".repeat(40);
const CAROL = "c".repeat(40);

let clock = 1_000_000;
/** Each call happens a millisecond after the one before, from its own IP address unless given. */
async function call(
  method: string,
  path: string,
  body?: unknown,
  headers: Record<string, string> = {},
): Promise<{ status: number; body: Record<string, unknown> & { error?: string } }> {
  clock += 1;
  const request = new Request(`https://api.example${path}`, {
    method,
    headers: { "cf-connecting-ip": `10.0.0.${clock % 250}`, ...headers },
    ...(body === undefined ? {} : { body: typeof body === "string" ? body : JSON.stringify(body) }),
  });
  const response = await handle(request, env, clock);
  return { status: response.status, body: (await response.json()) as never };
}

const ECHO = "INP\nOUT\nHLT";
const ECHO_LONG = "INP\nSTA x\nLDA x\nOUT\nHLT\nx DAT";

const payload = (wire: Record<string, unknown>) =>
  compressToEncodedURIComponent(JSON.stringify(wire));
const PROGRAM = payload({ v: 1, s: ECHO, d: "classic" });

describe("health and routing", () => {
  it("answers health checks and unknown routes", async () => {
    expect(await call("GET", "/health")).toEqual({ status: 200, body: { ok: true } });
    expect((await call("GET", "/nope")).status).toBe(404);
    expect((await call("PUT", "/health")).status).toBe(405);
  });

  it("lists the challenges with leaderboards, leaving out fixed programs", async () => {
    const { body } = await call("GET", "/challenges");
    expect(body.ranked).toContain("echo");
    expect(body.ranked).not.toContain("pick-a-cache");
    expect(body.ranked).not.toContain("lost-update");
  });

  it("allows only the configured sites, and answers preflight requests", async () => {
    const ok = await handle(
      new Request("https://api.example/health", {
        method: "OPTIONS",
        headers: { origin: "https://site.example" },
      }),
      env,
    );
    expect(ok.status).toBe(204);
    expect(ok.headers.get("access-control-allow-origin")).toBe("https://site.example");
    const other = await handle(
      new Request("https://api.example/health", { headers: { origin: "https://evil.example" } }),
      env,
    );
    expect(other.headers.get("access-control-allow-origin")).toBeNull();
    const none = await handle(new Request("https://api.example/health"), {
      ...env,
      ALLOWED_ORIGINS: undefined,
    } as unknown as Env);
    expect(none.headers.get("access-control-allow-origin")).toBeNull();
  });

  it("refuses bodies that are not JSON objects, or too large", async () => {
    expect((await call("POST", "/links", "not json")).body.error).toMatch(/not valid JSON/);
    expect((await call("POST", "/links", [1])).body.error).toMatch(/JSON object/);
    expect((await call("POST", "/links", "x".repeat(70_000))).status).toBe(413);
  });

  it("reports unexpected failures without details", async () => {
    const broken = { ...env, DB: undefined } as unknown as Env;
    const errors: unknown[] = [];
    const original = console.error;
    console.error = (e: unknown) => errors.push(e);
    const r = await handle(new Request("https://api.example/links/abcdefg"), broken);
    console.error = original;
    expect(r.status).toBe(500);
    expect(errors).toHaveLength(1);
  });
});

describe("leaderboards", () => {
  it("accepts only programs that pass, checked on the server", async () => {
    const failing = await call("POST", "/challenges/echo/scores", {
      key: ALICE,
      nickname: "Ama",
      source: "INP\nHLT",
    });
    expect(failing.status).toBe(422);
    expect(failing.body.error).toMatch(/3 of 3 tests fail/);
    const broken = await call("POST", "/challenges/echo/scores", {
      key: ALICE,
      nickname: "Ama",
      source: "FOO",
    });
    expect(broken.body.error).toMatch(/does not assemble/);
  });

  it("ranks players, keeping each best on its own", async () => {
    const first = await call("POST", "/challenges/echo/scores", {
      key: ALICE,
      nickname: "Ama",
      source: ECHO_LONG,
    });
    expect(first.status).toBe(200);
    expect(first.body.scores).toEqual({ instructions: 5, cycles: 5, mailboxes: 6 });
    await call("POST", "/challenges/echo/scores", { key: BOB, nickname: "Kofi", source: ECHO });
    const board = await call("GET", "/challenges/echo/scores?by=instructions", undefined, {
      "x-player-key": ALICE,
    });
    expect(board.body).toMatchObject({
      by: "instructions",
      players: 2,
      entries: [
        { rank: 1, nickname: "Kofi", score: 3, mine: false },
        { rank: 2, nickname: "Ama", score: 5, mine: true },
      ],
      mine: { rank: 2, score: 5 },
    });
    // A worse program later does not lower Ama's best; a better one raises it.
    const worse = await call("POST", "/challenges/echo/scores", {
      key: ALICE,
      nickname: "Ama B",
      source: `${ECHO_LONG}\ny DAT\nz DAT`,
    });
    expect(worse.body.best).toEqual({ instructions: 5, cycles: 5, mailboxes: 6 });
    const better = await call("POST", "/challenges/echo/scores", {
      key: ALICE,
      nickname: "Ama B",
      source: ECHO,
    });
    expect(better.body.best).toEqual({ instructions: 3, cycles: 3, mailboxes: 3 });
    // Equal scores share a rank; Kofi got there first.
    const tied = await call("GET", "/challenges/echo/scores?by=mailboxes", undefined, {
      "x-player-key": ALICE,
    });
    expect(tied.body.entries).toEqual([
      { rank: 1, nickname: "Kofi", score: 3, mine: false },
      { rank: 1, nickname: "Ama B", score: 3, mine: true },
    ]);
    expect(tied.body.mine).toEqual({ rank: 1, score: 3 });
  });

  it("shows no place for a player who has not posted", async () => {
    const r = await call("GET", "/challenges/echo/scores?limit=1", undefined, {
      "x-player-key": CAROL,
    });
    expect(r.body.entries).toHaveLength(1);
    expect(r.body.mine).toBeNull();
    expect((await call("GET", "/challenges/echo/scores")).body.mine).toBeNull();
  });

  it("refuses unknown challenges, fixed-program challenges and bad sorts", async () => {
    expect((await call("GET", "/challenges/nope/scores")).status).toBe(404);
    const fixed = await call("GET", "/challenges/pick-a-cache/scores");
    expect(fixed.body.error).toMatch(/no leaderboard/);
    expect((await call("GET", "/challenges/echo/scores?by=speed")).status).toBe(400);
  });

  it("checks the key, nickname and program", async () => {
    const post = (body: Record<string, unknown>) => call("POST", "/challenges/echo/scores", body);
    expect((await post({ nickname: "Ama", source: ECHO })).body.error).toMatch(/player key/);
    expect((await post({ key: CAROL, source: ECHO })).body.error).toMatch(/nickname is missing/);
    expect((await post({ key: CAROL, nickname: "A", source: ECHO })).body.error).toMatch(
      /too short/,
    );
    expect((await post({ key: CAROL, nickname: "x".repeat(21), source: ECHO })).body.error).toMatch(
      /too long/,
    );
    expect((await post({ key: CAROL, nickname: "-Ama", source: ECHO })).body.error).toMatch(
      /must start with a letter/,
    );
    expect((await post({ key: CAROL, nickname: "Sh1t head", source: ECHO })).body.error).toMatch(
      /different nickname/,
    );
    expect((await post({ key: CAROL, nickname: "Ama", source: "  " })).body.error).toMatch(
      /program is empty/,
    );
  });

  it("lets players take their entry off, and moderators hide one", async () => {
    await call("POST", "/challenges/echo/scores", { key: CAROL, nickname: "Esi", source: ECHO });
    const players = async () =>
      (await call("GET", "/challenges/echo/scores")).body.players as number;
    expect(await players()).toBe(3);
    const hide = await call(
      "POST",
      "/admin/moderate",
      { kind: "score", challenge: "echo", nickname: "Esi", action: "hide" },
      { authorization: "Bearer admin-secret" },
    );
    expect(hide.body).toEqual({ changed: 1 });
    expect(await players()).toBe(2);
    await call(
      "POST",
      "/admin/moderate",
      { kind: "score", challenge: "echo", nickname: "Esi", action: "show" },
      { authorization: "Bearer admin-secret" },
    );
    expect(await players()).toBe(3);
    const removed = await call("DELETE", "/challenges/echo/scores", undefined, {
      "x-player-key": CAROL,
    });
    expect(removed.body).toEqual({ deleted: true });
    expect(await players()).toBe(2);
  });
});

describe("the gallery", () => {
  let id = "";

  it("publishes a program and lists it", async () => {
    const r = await call("POST", "/programs", {
      key: ALICE,
      nickname: "Ama",
      title: "  Countdown  ",
      description: "Counts down from the input.",
      p: PROGRAM,
    });
    expect(r.status).toBe(200);
    id = r.body.id as string;
    expect(id).toMatch(/^[A-Za-z0-9]{8}$/);
    const mine = await call("GET", "/programs", undefined, { "x-player-key": ALICE });
    expect(mine.body.programs).toEqual([
      expect.objectContaining({
        id,
        title: "Countdown",
        nickname: "Ama",
        machine: "classic",
        p: PROGRAM,
        mine: true,
      }),
    ]);
    const one = await call("GET", `/programs/${id}`, undefined, { "x-player-key": BOB });
    expect(one.body).toMatchObject({ id, mine: false });
  });

  it("filters by machine and pages through older programs", async () => {
    for (let i = 0; i < 25; i++) {
      await call("POST", "/programs", {
        key: BOB,
        nickname: "Kofi",
        title: `Stack ${i}`,
        description: "",
        p: payload({ v: 1, s: ECHO, d: "classic", m: "e" }),
      });
    }
    const first = await call("GET", "/programs?machine=extended");
    expect(first.body.programs).toHaveLength(24);
    expect(first.body.next).toEqual(expect.any(String));
    const second = await call("GET", `/programs?machine=extended&before=${first.body.next}`);
    expect(second.body.programs).toHaveLength(1);
    expect(second.body.next).toBeNull();
    expect((await call("GET", "/programs?machine=multicore")).body.programs).toEqual([]);
    expect((await call("GET", "/programs?machine=risc")).status).toBe(400);
    expect((await call("GET", "/programs?before=soon")).status).toBe(400);
  });

  it("refuses payloads that are not share links, and rude titles", async () => {
    const post = (p: unknown, title = "Fine") =>
      call("POST", "/programs", { key: ALICE, nickname: "Ama", title, description: "", p });
    for (const bad of [
      42,
      "",
      "not-a-payload",
      payload({ v: 2, s: ECHO, d: "classic" }),
      payload({ v: 1, s: "  ", d: "classic" }),
      compressToEncodedURIComponent("7"),
    ]) {
      expect((await post(bad)).body.error).toMatch(/could not be read/);
    }
    expect((await post("A".repeat(17_000))).status).toBe(413);
    expect((await post(PROGRAM, "Shift register")).status).toBe(200);
    expect((await post(PROGRAM, "f u c k")).status).toBe(400);
    expect((await post(PROGRAM, "Fuck this")).body.error).toMatch(/reword the title/);
    const multi = await post(payload({ v: 1, s: ECHO, d: "classic", m: "m" }));
    expect((await call("GET", `/programs/${multi.body.id as string}`)).body.machine).toBe(
      "multicore",
    );
  });

  it("hides a program after enough reports, until a moderator keeps it", async () => {
    const report = (ip: string) =>
      call("POST", `/programs/${id}/report`, { reason: "spam" }, { "cf-connecting-ip": ip });
    expect((await report("1.1.1.1")).body).toEqual({ hidden: false });
    // The same visitor counts once.
    expect((await report("1.1.1.1")).body).toEqual({ hidden: false });
    for (let i = 2; i < REPORTS_TO_HIDE; i++) await report(`1.1.1.${i}`);
    expect((await report("2.2.2.2")).body).toEqual({ hidden: true });
    expect((await call("GET", `/programs/${id}`)).status).toBe(404);
    expect((await report("3.3.3.3")).status).toBe(404);

    const admin = { authorization: "Bearer admin-secret" };
    const queue = await call("GET", "/admin/reported", undefined, admin);
    expect(queue.body.programs).toEqual([
      expect.objectContaining({ id, reports: REPORTS_TO_HIDE, hidden: 1 }),
    ]);
    expect(queue.body.reasons).toHaveLength(REPORTS_TO_HIDE);
    await call("POST", "/admin/moderate", { kind: "program", id, action: "keep" }, admin);
    expect((await call("GET", `/programs/${id}`)).status).toBe(200);
    // Once kept, more reports no longer hide it.
    expect((await report("4.4.4.4")).body).toEqual({ hidden: false });
    await call("POST", "/admin/moderate", { kind: "program", id, action: "hide" }, admin);
    expect((await call("GET", `/programs/${id}`)).status).toBe(404);
  });

  it("lets only the publisher delete a program", async () => {
    const r = await call("POST", "/programs", {
      key: ALICE,
      nickname: "Ama",
      title: "Mine",
      description: "",
      p: PROGRAM,
    });
    const mine = r.body.id as string;
    await call("POST", `/programs/${mine}/report`, { reason: "" });
    const other = await call("DELETE", `/programs/${mine}`, undefined, { "x-player-key": BOB });
    expect(other.status).toBe(404);
    const own = await call("DELETE", `/programs/${mine}`, undefined, { "x-player-key": ALICE });
    expect(own.body).toEqual({ deleted: true });
    expect((await call("GET", `/programs/${mine}`)).status).toBe(404);
  });

  it("refuses moderation without the token, or when none is set", async () => {
    const body = { kind: "program", id, action: "delete" };
    expect((await call("POST", "/admin/moderate", body)).status).toBe(401);
    expect(
      (await call("POST", "/admin/moderate", body, { authorization: "Bearer wrong" })).status,
    ).toBe(401);
    const open = await handle(
      new Request("https://api.example/admin/reported", {
        headers: { authorization: "Bearer " },
      }),
      { ...env, ADMIN_TOKEN: undefined } as unknown as Env,
    );
    expect(open.status).toBe(401);
  });

  it("checks moderation requests, and deletes for good", async () => {
    const admin = { authorization: "Bearer admin-secret" };
    const moderate = (body: Record<string, unknown>) =>
      call("POST", "/admin/moderate", body, admin);
    expect((await moderate({ kind: "program", id, action: "burn" })).status).toBe(400);
    expect(
      (await moderate({ kind: "score", challenge: "echo", nickname: "Ama", action: "x" })).status,
    ).toBe(400);
    expect((await moderate({ kind: "user" })).status).toBe(400);
    expect((await moderate({ kind: "program", id, action: "delete" })).body).toEqual({
      changed: 1,
    });
    const queue = await call("GET", "/admin/reported", undefined, admin);
    expect(queue.body.programs).toEqual([]);
  });
});

describe("short links", () => {
  it("gives the same id for the same link, and resolves it", async () => {
    const path = `/sim?p=${PROGRAM}`;
    const a = await call("POST", "/links", { path });
    const b = await call("POST", "/links", { path });
    expect(a.body.id).toMatch(/^[A-Za-z0-9]{7}$/);
    expect(b.body.id).toBe(a.body.id);
    expect((await call("GET", `/links/${a.body.id as string}`)).body).toEqual({ path });
    const machine = await call("POST", "/links", { path: "/machines?m=abc$+-" });
    expect(machine.status).toBe(200);
  });

  it("shortens only Joe's SIM share links", async () => {
    for (const path of [
      "https://evil.example",
      "/sim?p=<script>",
      "/learn",
      "//evil.example/sim?p=a",
      7,
    ]) {
      expect((await call("POST", "/links", { path })).status).toBe(400);
    }
    expect((await call("POST", "/links", { path: `/sim?p=${"a".repeat(16_100)}` })).status).toBe(
      413,
    );
  });

  it("says when a short link does not exist", async () => {
    expect((await call("GET", "/links/abcdefg")).status).toBe(404);
    expect((await call("GET", "/links/short")).status).toBe(404);
  });
});

describe("rate limits", () => {
  it("refuses too many requests from one visitor, and sweeps old counters", async () => {
    const ip = { "cf-connecting-ip": "9.9.9.9" };
    for (let i = 0; i < LIMITS.link.max; i++) {
      expect((await call("POST", "/links", { path: `/sim?p=n${i}` }, ip)).status).toBe(200);
    }
    const refused = await call("POST", "/links", { path: "/sim?p=more" }, ip);
    expect(refused.status).toBe(429);
    expect(refused.body.retryAfterMinutes).toEqual(expect.any(Number));
    expect(await sweep(env, clock + LIMITS.link.windowMs * 2)).toBeGreaterThan(0);
    expect((await call("POST", "/links", { path: "/sim?p=more" }, ip)).status).toBe(200);
  });
});

describe("the worker", () => {
  it("routes fetches and runs the daily sweep", async () => {
    const r = await worker.fetch(new Request("https://api.example/health") as never, env);
    expect(r.status).toBe(200);
    await expect(worker.scheduled({} as never, env)).resolves.toBeUndefined();
  });
});

describe("names and ids", () => {
  it("catches rude words, including look-alike spellings, but not innocent words", () => {
    expect(isOffensive("Sh1t")).toBe(true);
    expect(isOffensive("big shits")).toBe(true);
    expect(isOffensive("fuckfuck")).toBe(true);
    expect(isOffensive("Class assignment")).toBe(false);
    expect(isOffensive("Kwame Mensah")).toBe(false);
    expect(isOffensive("Café")).toBe(false);
  });

  it("makes ids of the right length without look-alike characters", () => {
    for (let i = 0; i < 50; i++) expect(randomId(12)).toMatch(/^[a-km-np-zA-HJ-NP-Z2-9]{12}$/);
  });
});
