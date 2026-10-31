"use client";

import { BUILT_IN_PACKS, CHALLENGES, parsePack, type Pack, type PackItem } from "@joes-sim/content";
import { DIALECTS, DIALECT_IDS, isDialectId } from "@joes-sim/engine";
import { useRouter } from "next/navigation";
import { useEffect, useId, useState } from "react";
import { LESSONS, lessonBySlug } from "@/lessons/catalogue";
import { useSearch } from "@/lib/useSearch";
import { getPack, savePack } from "@/storage/packs";

const empty = (): Pack => ({
  format: "joes-sim-pack",
  version: 1,
  id: `pack-${Date.now().toString(36)}`,
  title: "",
  author: "",
  description: "",
  dialect: "classic",
  items: [],
});

const field = "min-h-11 w-full rounded-sm border border-border-strong bg-surface px-2";
const button = "min-h-11 rounded-sm border border-border-strong bg-surface px-3 text-sm";

function describe(item: PackItem): string {
  switch (item.type) {
    case "heading":
      return `Heading: ${item.title}`;
    case "lesson":
      return `Lesson: ${lessonBySlug(item.slug)?.title ?? item.slug}`;
    case "challenge":
      return `Challenge: ${CHALLENGES.find((c) => c.id === item.id)?.title ?? item.id}`;
    case "program":
      return `Program: ${item.title}`;
  }
}

/** A simple editor for teacher packs (brief, 7.10). Packs are saved on this device. */
export function PackEditor() {
  const search = useSearch();
  const router = useRouter();
  const [pack, setPack] = useState<Pack | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lesson, setLesson] = useState(LESSONS[0]?.slug ?? "");
  const [challenge, setChallenge] = useState(CHALLENGES[0]?.id ?? "");
  const [heading, setHeading] = useState("");
  const [program, setProgram] = useState({ title: "", source: "", inputs: "" });
  const ids = {
    title: useId(),
    author: useId(),
    desc: useId(),
    dialect: useId(),
    lesson: useId(),
    challenge: useId(),
    heading: useId(),
    pTitle: useId(),
    pSource: useId(),
    pInputs: useId(),
  };

  useEffect(() => {
    if (search === null) return;
    const params = new URLSearchParams(search);
    const id = params.get("id");
    const from = params.get("from");
    void (async () => {
      if (id) {
        const saved = await getPack(id).catch(() => undefined);
        if (saved) return setPack(saved);
      }
      const base = from
        ? (BUILT_IN_PACKS.find((p) => p.id === from) ??
          (await getPack(from).catch(() => undefined)))
        : undefined;
      setPack(
        base
          ? { ...base, id: `pack-${Date.now().toString(36)}`, title: `${base.title} (my copy)` }
          : empty(),
      );
    })();
  }, [search]);

  if (!pack) return <p className="text-muted">Opening the editor…</p>;
  const set = (change: Partial<Pack>) => setPack({ ...pack, ...change });
  const add = (item: PackItem) => set({ items: [...pack.items, item] });
  const move = (i: number, by: -1 | 1) => {
    const items = [...pack.items];
    const [it] = items.splice(i, 1);
    if (it) items.splice(i + by, 0, it);
    set({ items });
  };

  return (
    <form
      className="space-y-6"
      onSubmit={async (e) => {
        e.preventDefault();
        const r = parsePack(pack);
        if (!r.ok) return setError(r.error);
        await savePack(r.pack);
        router.push(`/packs/view?id=${encodeURIComponent(r.pack.id)}`);
      }}
    >
      <fieldset className="max-w-xl space-y-3">
        <legend className="mb-2 text-xl font-bold">About the pack</legend>
        <div>
          <label htmlFor={ids.title} className="block font-bold">
            Title
          </label>
          <input
            id={ids.title}
            required
            value={pack.title}
            onChange={(e) => set({ title: e.target.value })}
            className={field}
          />
        </div>
        <div>
          <label htmlFor={ids.author} className="block font-bold">
            Author
          </label>
          <input
            id={ids.author}
            value={pack.author}
            onChange={(e) => set({ author: e.target.value })}
            className={field}
          />
        </div>
        <div>
          <label htmlFor={ids.desc} className="block font-bold">
            Description
          </label>
          <textarea
            id={ids.desc}
            value={pack.description}
            onChange={(e) => set({ description: e.target.value })}
            rows={3}
            className={`${field} py-2`}
          />
        </div>
        <div>
          <label htmlFor={ids.dialect} className="block font-bold">
            Dialect for the pack&apos;s programs
          </label>
          <select
            id={ids.dialect}
            value={pack.dialect}
            onChange={(e) => isDialectId(e.target.value) && set({ dialect: e.target.value })}
            className={field}
          >
            {DIALECT_IDS.map((d) => (
              <option key={d} value={d}>
                {DIALECTS[d].name}
              </option>
            ))}
          </select>
        </div>
      </fieldset>

      <section aria-labelledby="items-h" className="space-y-2">
        <h2 id="items-h" className="text-xl font-bold">
          Contents, in order
        </h2>
        {pack.items.length === 0 ? (
          <p className="text-muted">
            Nothing yet. Add lessons, challenges, programs and headings below.
          </p>
        ) : (
          <ol className="space-y-1">
            {pack.items.map((item, i) => (
              <li
                key={i}
                className="flex flex-wrap items-center gap-1 rounded-sm border border-border bg-surface p-2"
              >
                <span className="grow">
                  {i + 1}. {describe(item)}
                </span>
                <button
                  type="button"
                  className={button}
                  disabled={i === 0}
                  onClick={() => move(i, -1)}
                  aria-label={`Move up: ${describe(item)}`}
                >
                  ↑
                </button>
                <button
                  type="button"
                  className={button}
                  disabled={i === pack.items.length - 1}
                  onClick={() => move(i, 1)}
                  aria-label={`Move down: ${describe(item)}`}
                >
                  ↓
                </button>
                <button
                  type="button"
                  className={`${button} text-danger`}
                  onClick={() => set({ items: pack.items.filter((_, j) => j !== i) })}
                  aria-label={`Remove: ${describe(item)}`}
                >
                  ✕
                </button>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section aria-labelledby="add-h" className="grid gap-4 md:grid-cols-2">
        <h2 id="add-h" className="text-xl font-bold md:col-span-2">
          Add to the pack
        </h2>
        <div className="space-y-1 rounded-md border border-border p-3">
          <label htmlFor={ids.lesson} className="block font-bold">
            A lesson
          </label>
          <select
            id={ids.lesson}
            value={lesson}
            onChange={(e) => setLesson(e.target.value)}
            className={field}
          >
            {LESSONS.map((l) => (
              <option key={l.slug} value={l.slug}>
                {l.title}
              </option>
            ))}
          </select>
          <button
            type="button"
            className={button}
            onClick={() => add({ type: "lesson", slug: lesson })}
          >
            Add lesson
          </button>
        </div>
        <div className="space-y-1 rounded-md border border-border p-3">
          <label htmlFor={ids.challenge} className="block font-bold">
            A challenge
          </label>
          <select
            id={ids.challenge}
            value={challenge}
            onChange={(e) => setChallenge(e.target.value)}
            className={field}
          >
            {CHALLENGES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
          <button
            type="button"
            className={button}
            onClick={() => add({ type: "challenge", id: challenge })}
          >
            Add challenge
          </button>
        </div>
        <div className="space-y-1 rounded-md border border-border p-3">
          <label htmlFor={ids.heading} className="block font-bold">
            A heading
          </label>
          <input
            id={ids.heading}
            value={heading}
            onChange={(e) => setHeading(e.target.value)}
            className={field}
          />
          <button
            type="button"
            className={button}
            onClick={() => {
              if (heading.trim()) {
                add({ type: "heading", title: heading.trim() });
                setHeading("");
              }
            }}
          >
            Add heading
          </button>
        </div>
        <div className="space-y-1 rounded-md border border-border p-3">
          <label htmlFor={ids.pTitle} className="block font-bold">
            A starter program: title
          </label>
          <input
            id={ids.pTitle}
            value={program.title}
            onChange={(e) => setProgram({ ...program, title: e.target.value })}
            className={field}
          />
          <label htmlFor={ids.pSource} className="block font-bold">
            Program
          </label>
          <textarea
            id={ids.pSource}
            value={program.source}
            onChange={(e) => setProgram({ ...program, source: e.target.value })}
            rows={6}
            className={`${field} py-2 font-mono text-sm`}
          />
          <label htmlFor={ids.pInputs} className="block font-bold">
            Inputs (optional)
          </label>
          <input
            id={ids.pInputs}
            value={program.inputs}
            onChange={(e) => setProgram({ ...program, inputs: e.target.value })}
            className={field}
          />
          <button
            type="button"
            className={button}
            onClick={() => {
              if (!program.title.trim() || !program.source.trim())
                return setError("A program needs a title and some code.");
              add({
                type: "program",
                title: program.title.trim(),
                source: program.source,
                ...(program.inputs.trim() ? { inputs: program.inputs.trim() } : {}),
              });
              setProgram({ title: "", source: "", inputs: "" });
              setError(null);
            }}
          >
            Add program
          </button>
        </div>
      </section>

      {error && (
        <p role="alert" className="text-danger">
          {error}
        </p>
      )}
      <button className="min-h-11 rounded-md bg-accent px-5 font-bold text-on-accent">
        Save the pack
      </button>
    </form>
  );
}
