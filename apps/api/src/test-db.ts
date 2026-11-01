/** A fresh local D1 database for tests (Miniflare, through Wrangler), with the migrations applied. */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { getPlatformProxy } from "wrangler";
import type { Env } from "./http";

const MIGRATIONS = join(import.meta.dirname, "..", "migrations");

export async function testEnv(vars: Partial<Omit<Env, "DB">> = {}) {
  const proxy = await getPlatformProxy<{ DB: D1Database }>({ persist: false });
  const db = proxy.env.DB;
  for (const file of readdirSync(MIGRATIONS).sort()) {
    const statements = readFileSync(join(MIGRATIONS, file), "utf8")
      .replace(/--.*$/gm, "")
      .split(";")
      .map((s) => s.trim())
      .filter(Boolean);
    await db.batch(statements.map((s) => db.prepare(s)));
  }
  const env: Env = {
    DB: db,
    ALLOWED_ORIGINS: "https://site.example",
    ADMIN_TOKEN: "admin-secret",
    HASH_SALT: "test",
    ...vars,
  };
  return { env, dispose: () => proxy.dispose() };
}
