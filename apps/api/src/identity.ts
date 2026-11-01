/**
 * No accounts. A player is someone holding a random key that their browser made; the server
 * keeps only a salted hash of it. A visitor is a salted hash of an IP address, used for rate
 * limits and to count one report per person.
 */
import { ApiError, type Env } from "./http";

export async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

const salted = (env: Env, kind: string, value: string) =>
  sha256(`${env.HASH_SALT ?? "joes-sim"}:${kind}:${value}`);

const KEY = /^[A-Za-z0-9_-]{32,128}$/;

/** The player's hash, from a key in the body or the X-Player-Key header. */
export async function player(env: Env, key: unknown): Promise<string> {
  if (typeof key !== "string" || !KEY.test(key)) {
    throw new ApiError(400, "The player key is missing or not valid.");
  }
  return salted(env, "player", key);
}

/** The player's hash if the request carries a valid key, otherwise null. */
export async function optionalPlayer(env: Env, request: Request): Promise<string | null> {
  const key = request.headers.get("x-player-key");
  return key && KEY.test(key) ? salted(env, "player", key) : null;
}

export function visitor(env: Env, request: Request): Promise<string> {
  return salted(env, "visitor", request.headers.get("cf-connecting-ip") ?? "unknown");
}

const ALPHABET = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** A random id of letters and digits, leaving out ones that look alike (0/O, 1/l/I). */
export function randomId(length: number): string {
  let id = "";
  while (id.length < length) {
    for (const b of crypto.getRandomValues(new Uint8Array(length))) {
      // 4 × 56 = 224: dropping bytes from 224 up keeps every letter equally likely.
      if (b < 224 && id.length < length) id += ALPHABET[b % ALPHABET.length];
    }
  }
  return id;
}
