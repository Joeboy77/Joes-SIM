import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

process.env.NEXT_PUBLIC_COMMUNITY_API = "https://api.example/";
const client = await import("./client");

const store = new Map<string, string>();
beforeEach(() => {
  store.clear();
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
  });
});
afterEach(() => vi.unstubAllGlobals());

function answer(status: number, body: unknown) {
  const fetch = vi.fn(async () => new Response(JSON.stringify(body), { status }));
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

const sent = (fetch: ReturnType<typeof answer>) => {
  const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
  return {
    url,
    method: init.method,
    headers: init.headers as Record<string, string>,
    body: init.body ? (JSON.parse(init.body as string) as Record<string, unknown>) : undefined,
  };
};

describe("the community client", () => {
  it("is on when the API address is set, without a trailing slash", () => {
    expect(client.communityOn).toBe(true);
    expect(client.COMMUNITY_API).toBe("https://api.example");
  });

  it("makes one player key per browser and remembers the nickname", () => {
    const first = client.getPlayer();
    expect(first.key).toMatch(/^[A-Za-z0-9_-]{32}$/);
    expect(client.getPlayer().key).toBe(first.key);
    expect(client.rememberNickname("Ama")).toEqual({ key: first.key, nickname: "Ama" });
    expect(client.getPlayer().nickname).toBe("Ama");
    store.set("joes-sim:player", "{broken");
    expect(client.getPlayer().key).not.toBe(first.key);
  });

  it("still works when storage is switched off", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("off");
      },
      setItem: () => {
        throw new Error("off");
      },
    });
    expect(client.getPlayer().key).toHaveLength(32);
  });

  it("reads boards and the gallery without making a key for someone who never posted", async () => {
    const fetch = answer(200, { entries: [] });
    await client.leaderboard("echo", "instructions");
    expect(sent(fetch).headers["x-player-key"]).toBeUndefined();
    expect(client.savedPlayer()).toBeNull();
    const list = answer(200, { programs: [], next: null });
    await client.listPrograms(null, null);
    expect(sent(list).headers["x-player-key"]).toBeUndefined();
    expect(store.size).toBe(0);
  });

  it("posts scores with the key and nickname, and reads boards with the key", async () => {
    const fetch = answer(200, { scores: {}, best: {} });
    await client.postScore("echo", "Ama", "INP");
    const post = sent(fetch);
    expect(post.url).toBe("https://api.example/challenges/echo/scores");
    expect(post.method).toBe("POST");
    expect(post.body).toEqual({ key: client.getPlayer().key, nickname: "Ama", source: "INP" });

    const get = answer(200, { entries: [] });
    await client.leaderboard("echo", "cycles");
    expect(sent(get).url).toBe("https://api.example/challenges/echo/scores?by=cycles");
    expect(sent(get).headers["x-player-key"]).toBe(client.getPlayer().key);

    const del = answer(200, { deleted: true });
    await client.removeScore("echo");
    expect(sent(del).method).toBe("DELETE");
  });

  it("lists, publishes, deletes and reports gallery programs", async () => {
    let fetch = answer(200, { programs: [], next: null });
    await client.listPrograms(null, null);
    expect(sent(fetch).url).toBe("https://api.example/programs");
    fetch = answer(200, { programs: [], next: null });
    await client.listPrograms("extended", "5.ab");
    expect(sent(fetch).url).toBe("https://api.example/programs?machine=extended&before=5.ab");

    fetch = answer(200, { id: "abcdefgh" });
    expect(
      await client.publishProgram({ nickname: "Kofi", title: "T", description: "", payload: "p" }),
    ).toEqual({ id: "abcdefgh" });
    expect(sent(fetch).body).toMatchObject({ nickname: "Kofi", title: "T", p: "p" });

    fetch = answer(200, { deleted: true });
    await client.deleteProgram("abcdefgh");
    expect(sent(fetch)).toMatchObject({
      method: "DELETE",
      url: "https://api.example/programs/abcdefgh",
    });

    fetch = answer(200, { hidden: false });
    await client.reportProgram("abcdefgh", "spam");
    expect(sent(fetch).body).toEqual({ reason: "spam" });
  });

  it("shortens and resolves links", async () => {
    const fetch = answer(200, { id: "abcdefg" });
    expect(await client.shortenLink("/sim?p=x")).toEqual({ id: "abcdefg" });
    expect(sent(fetch).body).toEqual({ path: "/sim?p=x" });
    answer(200, { path: "/sim?p=x" });
    expect(await client.resolveLink("abcdefg")).toBe("/sim?p=x");
    answer(404, { error: "That short link does not exist." });
    expect(await client.resolveLink("abcdefg")).toBeNull();
    expect(await client.resolveLink("../etc")).toBeNull();
    expect(await client.resolveLink("abcdefg", "")).toBeNull();
  });

  it("passes on the server's error, or explains when it cannot be reached", async () => {
    answer(429, { error: "Too many at once." });
    await expect(client.shortenLink("/sim?p=x")).rejects.toMatchObject({
      message: "Too many at once.",
      status: 429,
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("<html>", { status: 502 })),
    );
    await expect(client.shortenLink("/sim?p=x")).rejects.toThrow(/Something went wrong/);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("network");
      }),
    );
    await expect(client.shortenLink("/sim?p=x")).rejects.toThrow(/could not be reached/);
    vi.stubGlobal("navigator", { onLine: false });
    await expect(client.shortenLink("/sim?p=x")).rejects.toThrow(/You are offline/);
  });
});
