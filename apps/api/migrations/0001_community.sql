-- Phase 11: leaderboards, the gallery and short links. No accounts: a "player" is a hash of a
-- random key that stays in the learner's browser, and a "visitor" is a hash of an IP address.

-- One row per player per challenge. Each best score is kept on its own, with the time it was
-- first reached, so ties go to whoever got there first. The program itself is not stored.
CREATE TABLE scores (
  challenge TEXT NOT NULL,
  player TEXT NOT NULL,
  nickname TEXT NOT NULL,
  instructions INTEGER NOT NULL,
  instructions_at INTEGER NOT NULL,
  cycles INTEGER NOT NULL,
  cycles_at INTEGER NOT NULL,
  mailboxes INTEGER NOT NULL,
  mailboxes_at INTEGER NOT NULL,
  hidden INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (challenge, player)
);
CREATE INDEX scores_instructions ON scores (challenge, hidden, instructions, instructions_at);
CREATE INDEX scores_cycles ON scores (challenge, hidden, cycles, cycles_at);
CREATE INDEX scores_mailboxes ON scores (challenge, hidden, mailboxes, mailboxes_at);

-- Programs published to the gallery. `p` is the share-link payload, as in /sim?p=...
CREATE TABLE programs (
  id TEXT PRIMARY KEY,
  player TEXT NOT NULL,
  nickname TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  machine TEXT NOT NULL,
  p TEXT NOT NULL,
  created INTEGER NOT NULL,
  reports INTEGER NOT NULL DEFAULT 0,
  -- 0 shown; 1 hidden until reviewed (reported, or hidden by a moderator).
  hidden INTEGER NOT NULL DEFAULT 0,
  -- 1 once a moderator has looked and kept it: further reports no longer hide it.
  reviewed INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX programs_newest ON programs (hidden, created, id);
CREATE INDEX programs_machine ON programs (hidden, machine, created, id);

-- One report per visitor per program.
CREATE TABLE reports (
  program TEXT NOT NULL,
  visitor TEXT NOT NULL,
  reason TEXT NOT NULL,
  created INTEGER NOT NULL,
  PRIMARY KEY (program, visitor)
);

-- Short links: /s/<id> opens `path` on the site.
CREATE TABLE links (
  id TEXT PRIMARY KEY,
  path TEXT NOT NULL,
  hash TEXT NOT NULL UNIQUE,
  created INTEGER NOT NULL
);

-- Rate-limit counters, one per action, visitor and time window.
CREATE TABLE hits (
  bucket TEXT PRIMARY KEY,
  count INTEGER NOT NULL,
  expires INTEGER NOT NULL
);
