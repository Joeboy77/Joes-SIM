"use client";

import { useCallback, useEffect, useId, useState } from "react";
import {
  CommunityError,
  MEASURES,
  leaderboard,
  postScore,
  removeScore,
  savedPlayer,
  type Board,
  type Measure,
} from "./client";

const RANK_BY: Record<Measure, string> = {
  instructions: "Fewest instructions",
  cycles: "Fewest steps",
  mailboxes: "Fewest mailboxes",
};

const ordinal = (n: number) => {
  const end = n % 100 >= 11 && n % 100 <= 13 ? "th" : (["th", "st", "nd", "rd"][n % 10] ?? "th");
  return `${n}${end}`;
};

const message = (e: unknown) =>
  e instanceof CommunityError ? e.message : "Something went wrong. Please try again.";

/**
 * The challenge's leaderboard (Phase 11). Anonymous: a nickname, no account. The server runs the
 * program itself before accepting a score, and does not keep it.
 */
export function Leaderboard({
  challenge,
  passingSource,
}: {
  challenge: string;
  /** The program that last passed every test here, if any. */
  passingSource: string | null;
}) {
  const [by, setBy] = useState<Measure>("instructions");
  // Nothing is fetched until the learner asks to see the leaderboard.
  const [shown, setShown] = useState(false);
  const [board, setBoard] = useState<Board | null>(null);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [nickname, setNickname] = useState("");
  const ids = { by: useId(), nick: useId(), heading: useId() };

  const load = useCallback(async () => {
    try {
      setBoard(await leaderboard(challenge, by));
      setError("");
    } catch (e) {
      setError(message(e));
    }
  }, [challenge, by]);

  useEffect(() => {
    if (!shown) return;
    // The board arrives later, so this is not a synchronous update.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load, shown]);
  useEffect(() => {
    // localStorage exists only in the browser, after the first render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNickname(savedPlayer()?.nickname ?? "");
  }, []);

  const post = async () => {
    if (!passingSource) return;
    setBusy(true);
    setStatus("");
    try {
      const r = await postScore(challenge, nickname.trim(), passingSource);
      setStatus(
        `Posted as ${nickname.trim()}. Your best: ${r.best.instructions} instructions, ${r.best.cycles} steps, ${r.best.mailboxes} mailboxes.`,
      );
      setError("");
      if (shown) await load();
      else setShown(true);
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  };

  const withdraw = async () => {
    setBusy(true);
    try {
      await removeScore(challenge);
      setStatus("Your scores are off this leaderboard.");
      setError("");
      await load();
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-labelledby={ids.heading} className="space-y-2">
      <h2 id={ids.heading} className="font-bold">
        Leaderboard
      </h2>
      {!shown && (
        <button
          type="button"
          onClick={() => setShown(true)}
          className="min-h-11 rounded-md border border-border-strong px-4 text-sm font-bold"
        >
          Show the leaderboard
        </button>
      )}
      <div className={shown ? "flex flex-wrap items-center gap-2" : "hidden"}>
        <label htmlFor={ids.by} className="text-sm">
          Rank by
        </label>
        <select
          id={ids.by}
          value={by}
          onChange={(e) => setBy(e.target.value as Measure)}
          className="min-h-11 rounded-sm border border-border-strong bg-surface px-2 text-sm"
        >
          {MEASURES.map((m) => (
            <option key={m} value={m}>
              {RANK_BY[m]}
            </option>
          ))}
        </select>
      </div>
      {board &&
        (board.entries.length === 0 ? (
          <p className="text-sm text-muted">Nobody has posted a score yet. Be the first!</p>
        ) : (
          <ol
            aria-label={`Leaderboard, ${RANK_BY[by].toLowerCase()}`}
            className="space-y-1 text-sm"
          >
            {board.entries.map((e, i) => (
              <li
                key={i}
                className={`flex gap-2 rounded-sm px-2 py-1 ${e.mine ? "border-2 border-accent font-bold" : "bg-surface-2"}`}
              >
                <span className="w-10 tabular-nums">{ordinal(e.rank)}</span>
                <span className="flex-1 break-all">
                  {e.nickname}
                  {e.mine && " (you)"}
                </span>
                <span className="tabular-nums">{e.score}</span>
              </li>
            ))}
          </ol>
        ))}
      {board?.mine && (
        <p className="text-sm">
          You are {ordinal(board.mine.rank)} of {board.players} with {board.mine.score}.{" "}
          <button
            type="button"
            onClick={() => void withdraw()}
            disabled={busy}
            className="text-accent underline"
          >
            Take my scores off
          </button>
        </p>
      )}
      {passingSource ? (
        <form
          className="space-y-2 rounded-md border border-border p-2"
          onSubmit={(e) => {
            e.preventDefault();
            void post();
          }}
        >
          <label htmlFor={ids.nick} className="block text-sm font-bold">
            Nickname
          </label>
          <div className="flex flex-wrap gap-2">
            <input
              id={ids.nick}
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              required
              minLength={2}
              maxLength={20}
              autoComplete="nickname"
              className="min-h-11 min-w-0 flex-1 rounded-sm border border-border-strong bg-surface px-2"
            />
            <button
              type="submit"
              disabled={busy}
              className="min-h-11 rounded-md bg-accent px-4 text-sm font-bold text-on-accent"
            >
              Post my scores
            </button>
          </div>
          <p className="text-xs text-muted">
            Your nickname and scores will be public. Don&apos;t use your real name. The server
            checks your program and then throws it away, so nobody else sees it.
          </p>
        </form>
      ) : (
        <p className="text-sm text-muted">Pass every test to post your scores here.</p>
      )}
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      <p role="status" className="min-h-5 text-sm text-success">
        {status}
      </p>
    </section>
  );
}
