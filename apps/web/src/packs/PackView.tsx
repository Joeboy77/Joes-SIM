"use client";

import { BUILT_IN_PACKS, CHALLENGES, type Pack } from "@joes-sim/content";
import { DIALECTS } from "@joes-sim/engine";
import Link from "next/link";
import { useEffect, useState } from "react";
import { lessonBySlug } from "@/lessons/catalogue";
import { useSearch } from "@/lib/useSearch";
import { sharePath } from "@/sim/workspace/share";
import { downloadText } from "@/storage/backup";
import { getPack, packFileName, packFromLink, packLink, savePack } from "@/storage/packs";
import { EMPTY_PROGRESS, getProgress, type Progress } from "@/storage/progress";

type Found = { pack: Pack; source: "built-in" | "device" | "link" } | "missing" | null;

export function PackView() {
  const search = useSearch();
  const [found, setFound] = useState<Found>(null);
  const [progress, setProgress] = useState<Progress>(EMPTY_PROGRESS);
  const [note, setNote] = useState("");

  useEffect(() => {
    if (search === null) return;
    const params = new URLSearchParams(search);
    const id = params.get("id");
    const fromLink = packFromLink(params.get("pack"));
    const builtIn = BUILT_IN_PACKS.find((p) => p.id === id);
    void (async () => {
      setProgress(await getProgress().catch(() => EMPTY_PROGRESS));
      if (fromLink) return setFound({ pack: fromLink, source: "link" });
      if (builtIn) return setFound({ pack: builtIn, source: "built-in" });
      const saved = id ? await getPack(id).catch(() => undefined) : undefined;
      setFound(saved ? { pack: saved, source: "device" } : "missing");
    })();
  }, [search]);

  if (found === null) return <p className="text-muted">Opening the pack…</p>;
  if (found === "missing") {
    return (
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">Pack not found</h1>
        <p>
          This pack is not on this device. Ask for the pack file or link, or see{" "}
          <Link href="/packs" className="text-accent underline">
            all packs
          </Link>
          .
        </p>
      </div>
    );
  }
  const { pack, source } = found;
  const steps = pack.items.filter((i) => i.type !== "heading");
  const done = steps.filter(
    (i) =>
      (i.type === "lesson" && progress.lessons[i.slug]) ||
      (i.type === "challenge" && progress.challenges[i.id]?.solved),
  ).length;
  const countable = steps.filter((i) => i.type === "lesson" || i.type === "challenge").length;
  let n = 0;

  return (
    <article className="space-y-4">
      <p className="text-sm">
        <Link href="/packs" className="text-accent underline">
          Teacher packs
        </Link>
      </p>
      <h1 className="text-3xl font-bold">{pack.title}</h1>
      {pack.author && <p className="text-muted">By {pack.author}</p>}
      {pack.description && <p className="max-w-prose">{pack.description}</p>}
      <p className="text-sm text-muted">
        {DIALECTS[pack.dialect].name} dialect · {done} of {countable} lessons and challenges done on
        this device
      </p>
      <div className="flex flex-wrap gap-2">
        {source === "link" && (
          <button
            type="button"
            onClick={async () => {
              await savePack(pack);
              setFound({ pack, source: "device" });
              setNote("Saved on this device. It is now in your packs.");
            }}
            className="min-h-11 rounded-md bg-accent px-4 font-bold text-on-accent"
          >
            Keep this pack on this device
          </button>
        )}
        <button
          type="button"
          onClick={() =>
            downloadText(packFileName(pack), JSON.stringify(pack, null, 2), "application/json")
          }
          className="min-h-11 rounded-md border border-border-strong px-4"
        >
          Download the pack file
        </button>
        <button
          type="button"
          onClick={async () => {
            await navigator.clipboard
              .writeText(`${window.location.origin}${packLink(pack)}`)
              .catch(() => undefined);
            setNote("Link copied. Anyone with it can open this pack.");
          }}
          className="min-h-11 rounded-md border border-border-strong px-4"
        >
          Copy a link to this pack
        </button>
        <Link
          href={
            source === "device"
              ? `/packs/edit?id=${encodeURIComponent(pack.id)}`
              : `/packs/edit?from=${encodeURIComponent(pack.id)}`
          }
          className="inline-flex min-h-11 items-center rounded-md border border-border-strong px-4"
        >
          {source === "device" ? "Edit this pack" : "Make my own copy to edit"}
        </Link>
      </div>
      <p role="status" className="min-h-6 text-sm text-success">
        {note}
      </p>

      <ol className="space-y-2">
        {pack.items.map((item, i) => {
          if (item.type === "heading") {
            return (
              <li key={i} className="list-none pt-4">
                <h2 className="text-xl font-bold">{item.title}</h2>
                {item.note && <p className="max-w-prose text-sm text-muted">{item.note}</p>}
              </li>
            );
          }
          n++;
          let href = "";
          let label = "";
          let kind = "";
          let complete = false;
          let missing = false;
          if (item.type === "lesson") {
            const lesson = lessonBySlug(item.slug);
            missing = !lesson;
            href = `/learn/${item.slug}`;
            label = lesson?.title ?? item.slug;
            kind = "Lesson";
            complete = !!progress.lessons[item.slug];
          } else if (item.type === "challenge") {
            const c = CHALLENGES.find((x) => x.id === item.id);
            missing = !c;
            href = `/challenges/${item.id}`;
            label = c?.title ?? item.id;
            kind = c?.kind === "bug-hunt" ? "Bug hunt" : "Challenge";
            complete = !!progress.challenges[item.id]?.solved;
          } else {
            href = sharePath({
              name: item.title,
              source: item.source,
              dialect: pack.dialect,
              inputs: item.inputs ?? "",
              view: "datapath",
            });
            label = item.title;
            kind = "Program";
          }
          return (
            <li key={i} className="flex gap-3 rounded-md border border-border bg-surface p-3">
              <span aria-hidden="true" className="w-6 shrink-0 font-bold text-muted">
                {n}
              </span>
              <div>
                <p>
                  <span className="text-sm text-muted">{kind}: </span>
                  {missing ? (
                    <span>{label} (not in this version of Joe&apos;s SIM)</span>
                  ) : (
                    <Link
                      href={href}
                      className="font-bold text-accent underline-offset-4 hover:underline"
                    >
                      {label}
                    </Link>
                  )}
                  {complete && (
                    <span className="ms-2 text-sm font-bold text-success">
                      <span aria-hidden="true">✓ </span>Done
                    </span>
                  )}
                </p>
                {item.note && <p className="text-sm">{item.note}</p>}
              </div>
            </li>
          );
        })}
      </ol>
    </article>
  );
}
