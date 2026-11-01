# The community API (Phase 11)

An optional backend for the three things that need a server: challenge leaderboards, a public
gallery of programs, and short share links. The code is in [`apps/api`](../../apps/api/). It runs
on Cloudflare Workers with a D1 (SQLite) database. The site works fully without it: it is
switched on only when the web app is built with `NEXT_PUBLIC_COMMUNITY_API` set to the API's
address.

## No accounts

- **Players.** The first time someone posts a score or publishes a program, their browser makes a
  random 24-byte key and keeps it in `localStorage` (`joes-sim:player`), with their last nickname.
  The server stores only `SHA-256(HASH_SALT : "player" : key)`. Holding the key lets that browser
  update its scores, take them off, and delete its own programs. Losing it (for example, by
  clearing site data) only means those things can no longer be changed from a new browser.
- **Visitors.** For rate limits and to count one report per person, the server uses
  `SHA-256(HASH_SALT : "visitor" : IP address)`. IP addresses themselves are never stored.
- **Nicknames.** 2 to 20 characters: letters and digits in any script, spaces, and `_ . ' -`. The
  first must be a letter or digit. A short list of offensive words is refused, including
  look-alike spellings (`sh1t`). Reports and the moderator catch the rest.

## Leaderboards

Every challenge has a leaderboard except those whose program is fixed (choose a cache, or choose
the order of the cores), since every solver's scores would be the same
(`hasLeaderboard` in `@joes-sim/content`).

- **Posting.** The browser sends the program. The server runs it against the challenge's tests with
  `runChallenge`, the same code the browser uses. Only a program that passes every test is
  accepted. The program is then thrown away: solutions never become public.
- **Bests.** One entry per player per challenge. Instructions, steps (cycles) and mailboxes are each
  kept as the player's best on its own, with the time it was first reached. The nickname is the
  one used most recently.
- **Ranking.** Lower is better. Equal scores share a rank, and whoever reached the score first is
  listed first. A player's own place is reported even when it is outside the top entries.

## The gallery

A published program is stored as its share payload: the `p` of `/sim?p=...`, as described in
decision 0027. The server checks that the payload decompresses to a version 1 share with a
non-empty program, and records which machine it is for. Title: 1 to 80 characters. Description:
up to 500 characters. Payload: at most 16,000 characters. Pages hold 24 programs, newest first.
They can be filtered by machine.

**Reports.** Each visitor can report a program once. Reports from 3 visitors hide it until the
moderator looks at it. A program the moderator keeps cannot be hidden by reports again.

## Short links

`POST /links` takes a path of the form `/sim?p=...` or `/machines?m=...` and returns a 7-character
id. The same path always gets the same id. The site's page `/s/<id>` looks up the id on the server
and redirects to the path. It follows only paths of those two forms. If the id is unknown, or the
API cannot be reached, the page says so.

## Routes

All bodies are JSON. Errors are `{ "error": "<a sentence for the learner>" }` with a 4xx status.

| Method and path                 | Body or query                                | Answer                                      |
| ------------------------------- | -------------------------------------------- | ------------------------------------------- |
| `GET /health`                   |                                              | `{ ok: true }`                              |
| `GET /challenges`               |                                              | `{ ranked: [ids] }`                         |
| `GET /challenges/:id/scores`    | `?by=instructions\|cycles\|mailboxes&limit=` | `{ by, entries, mine, players }`            |
| `POST /challenges/:id/scores`   | `{ key, nickname, source }`                  | `{ scores, best }`, or 422 if a test fails  |
| `DELETE /challenges/:id/scores` | header `X-Player-Key`                        | `{ deleted: true }`                         |
| `GET /programs`                 | `?machine=&before=`                          | `{ programs, next }`                        |
| `POST /programs`                | `{ key, nickname, title, description, p }`   | `{ id }`                                    |
| `GET /programs/:id`             |                                              | the program                                 |
| `DELETE /programs/:id`          | header `X-Player-Key`                        | `{ deleted: true }`, only for the publisher |
| `POST /programs/:id/report`     | `{ reason }` (may be empty)                  | `{ hidden }`                                |
| `POST /links`                   | `{ path }`                                   | `{ id }`                                    |
| `GET /links/:id`                |                                              | `{ path }`                                  |
| `GET /admin/reported`           | header `Authorization: Bearer <ADMIN_TOKEN>` | reported programs and reasons               |
| `POST /admin/moderate`          | see below                                    | `{ changed }`                               |

`GET` requests send `X-Player-Key` only when the browser already has a key (reading never makes one), so that answers can mark the
player's own entries (`mine`).

Moderation bodies:

- `{ "kind": "program", "id": "...", "action": "hide" | "keep" | "delete" }`
- `{ "kind": "score", "challenge": "...", "nickname": "...", "action": "hide" | "show" }`

## Limits

| Action               | Per visitor per hour |
| -------------------- | -------------------- |
| Posting a score      | 30                   |
| Publishing a program | 10                   |
| Making a short link  | 60                   |
| Reporting            | 20                   |

Request bodies are limited to 64 KB, and programs to 20,000 characters. Over a limit, the answer is
429 with `retryAfterMinutes`. A daily cron trigger deletes expired counters.

## Cross-origin requests

The API answers browsers only from the sites listed in `ALLOWED_ORIGINS` (comma-separated). It
accepts the headers `content-type`, `x-player-key` and `authorization`.
