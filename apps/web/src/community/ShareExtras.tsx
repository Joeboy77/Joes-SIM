"use client";

import Link from "next/link";
import { useEffect, useId, useState } from "react";
import { CommunityError, getPlayer, publishProgram, shortenLink } from "./client";

const message = (e: unknown) =>
  e instanceof CommunityError ? e.message : "Something went wrong. Please try again.";

/** Turns a long share path (/sim?p=...) into a short /s/<id> link on this site. */
export function ShortLink({ path }: { path: string }) {
  const [short, setShort] = useState<{ path: string; link: string } | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const inputId = useId();
  // A short link is for one program: a changed program needs a new one.
  const link = short?.path === path ? short.link : "";

  return (
    <div className="space-y-2">
      {link ? (
        <>
          <label htmlFor={inputId} className="block text-sm font-bold">
            Short link
          </label>
          <div className="flex flex-wrap gap-2">
            <input
              id={inputId}
              readOnly
              value={link}
              onFocus={(e) => e.target.select()}
              className="min-h-11 min-w-0 flex-1 rounded-sm border border-border-strong bg-surface-2 px-2 font-mono text-sm"
            />
            <button
              type="button"
              onClick={async () => {
                await navigator.clipboard.writeText(link).catch(() => undefined);
                setCopied(true);
              }}
              className="min-h-11 rounded-md border border-border-strong px-4"
            >
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        </>
      ) : (
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setCopied(false);
            try {
              const { id } = await shortenLink(path);
              setShort({ path, link: `${window.location.origin}/s/${id}` });
              setError("");
            } catch (e) {
              setError(message(e));
            } finally {
              setBusy(false);
            }
          }}
          className="min-h-11 rounded-md border border-border-strong px-4"
        >
          {busy ? "Making a short link…" : "Make a short link"}
        </button>
      )}
      <p className="text-xs text-muted">
        A short link is stored on the Joe&apos;s SIM server, so anyone with it can open the program.
      </p>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

/** Publishes a program to the public gallery, under a nickname. */
export function PublishForm({ payload, name }: { payload: string; name: string }) {
  const [title, setTitle] = useState(name);
  const [description, setDescription] = useState("");
  const [nickname, setNickname] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [published, setPublished] = useState<string | null>(null);
  const ids = { title: useId(), description: useId(), nick: useId() };

  useEffect(() => {
    // localStorage exists only in the browser, after the first render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNickname(getPlayer().nickname);
  }, []);

  if (published) {
    return (
      <p role="status" className="text-sm text-success">
        Published.{" "}
        <Link href={`/gallery?program=${published}`} className="text-accent underline">
          See it in the gallery
        </Link>
        . You can delete it there at any time from this browser.
      </p>
    );
  }
  const field = "min-h-11 w-full rounded-sm border border-border-strong bg-surface px-2 text-text";
  return (
    <form
      className="space-y-2"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          const { id } = await publishProgram({
            nickname: nickname.trim(),
            title: title.trim(),
            description: description.trim(),
            payload,
          });
          setPublished(id);
        } catch (err) {
          setError(message(err));
        } finally {
          setBusy(false);
        }
      }}
    >
      <p className="text-sm text-muted">
        Everyone can see programs in the gallery, with your nickname. Don&apos;t include your real
        name or anything personal.
      </p>
      <label htmlFor={ids.title} className="block text-sm font-bold">
        Title
      </label>
      <input
        id={ids.title}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        required
        maxLength={80}
        className={field}
      />
      <label htmlFor={ids.description} className="block text-sm font-bold">
        What it does (optional)
      </label>
      <textarea
        id={ids.description}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        maxLength={500}
        rows={3}
        className={`${field} py-1`}
      />
      <label htmlFor={ids.nick} className="block text-sm font-bold">
        Your nickname
      </label>
      <input
        id={ids.nick}
        value={nickname}
        onChange={(e) => setNickname(e.target.value)}
        required
        minLength={2}
        maxLength={20}
        autoComplete="nickname"
        className={field}
      />
      <button
        type="submit"
        disabled={busy}
        className="min-h-11 rounded-md bg-accent px-4 font-bold text-on-accent"
      >
        {busy ? "Publishing…" : "Publish"}
      </button>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
    </form>
  );
}
