/**
 * Nicknames and titles that everyone can see. The check here catches the obvious cases; reports
 * and the moderator catch the rest (docs/decisions/0039-community-backend.md).
 */
import { ApiError, text } from "./http";

/** Letters and digits in any script, spaces, and a few marks. */
const NICKNAME = /^[\p{L}\p{N}][\p{L}\p{N} _.'-]*$/u;

/** Matched as whole words after undoing look-alike spellings. */
const BLOCKED_WORDS = [
  "ass",
  "arse",
  "bitch",
  "cock",
  "cunt",
  "dick",
  "fag",
  "fuck",
  "nazi",
  "nigga",
  "nigger",
  "piss",
  "porn",
  "pussy",
  "rape",
  "shit",
  "slut",
  "whore",
];
/** Also matched inside longer words, since they are rarely part of an innocent one. */
const BLOCKED_PARTS = ["fuck", "cunt", "nigger", "nigga", "shit", "whore", "porn"];

const LOOK_ALIKE: Record<string, string> = {
  "0": "o",
  "1": "i",
  "3": "e",
  "4": "a",
  "5": "s",
  "7": "t",
  "@": "a",
  $: "s",
};

/** Whether text contains a word nobody should see on a learning site. */
export function isOffensive(value: string): boolean {
  const plain = value
    .toLowerCase()
    .replace(/[013457@$]/g, (c) => LOOK_ALIKE[c] ?? c)
    .normalize("NFKD")
    .replace(/\p{M}/gu, "");
  const words = plain.split(/[^\p{L}]+/u).filter(Boolean);
  const joined = words.join("");
  return (
    words.some((w) => BLOCKED_WORDS.includes(w) || BLOCKED_WORDS.includes(w.replace(/s$/, ""))) ||
    BLOCKED_PARTS.some((p) => joined.includes(p))
  );
}

export function nickname(body: Record<string, unknown>): string {
  const name = text(body, "nickname", { min: 2, max: 20, label: "The nickname" }).replace(
    /\s+/g,
    " ",
  );
  if (!NICKNAME.test(name)) {
    throw new ApiError(
      400,
      "A nickname can use letters, digits, spaces, and _ . ' - and must start with a letter or digit.",
    );
  }
  if (isOffensive(name)) throw new ApiError(400, "Please choose a different nickname.");
  return name;
}

/** Visible text such as a title: no offensive words. */
export function clean(value: string, label: string): string {
  if (isOffensive(value)) throw new ApiError(400, `Please reword the ${label}.`);
  return value;
}
