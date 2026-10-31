"use client";

import { BUILT_IN_PACKS, parsePack, type Pack } from "@joes-sim/content";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { deletePack, listPacks, savePack } from "@/storage/packs";

export function PackHome() {
  const [mine, setMine] = useState<Pack[]>([]);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    void listPacks()
      .then(setMine)
      .catch(() => undefined);
  }, []);

  return (
    <div className="space-y-8">
      <section aria-labelledby="built-h" className="space-y-2">
        <h2 id="built-h" className="text-xl font-bold">
          Ready-made packs
        </h2>
        <ul className="space-y-2">
          {BUILT_IN_PACKS.map((p) => (
            <li key={p.id} className="rounded-md border border-border bg-surface p-3">
              <Link
                href={`/packs/view?id=${p.id}`}
                className="font-bold text-accent underline-offset-4 hover:underline"
              >
                {p.title}
              </Link>
              <p className="text-sm">{p.description}</p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="mine-h" className="space-y-2">
        <h2 id="mine-h" className="text-xl font-bold">
          Packs on this device
        </h2>
        {mine.length === 0 ? (
          <p className="text-muted">None yet. Make one, or open a pack file a teacher gave you.</p>
        ) : (
          <ul className="space-y-2">
            {mine.map((p) => (
              <li
                key={p.id}
                className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-surface p-3"
              >
                <Link
                  href={`/packs/view?id=${encodeURIComponent(p.id)}`}
                  className="grow font-bold text-accent underline-offset-4 hover:underline"
                >
                  {p.title}
                </Link>
                <Link
                  href={`/packs/edit?id=${encodeURIComponent(p.id)}`}
                  className="min-h-11 rounded-sm border border-border-strong px-3 py-2 text-sm"
                >
                  Edit<span className="sr-only"> {p.title}</span>
                </Link>
                <button
                  type="button"
                  onClick={async () => {
                    if (!window.confirm(`Delete the pack "${p.title}" from this device?`)) return;
                    await deletePack(p.id);
                    setMine(await listPacks());
                  }}
                  className="min-h-11 rounded-sm border border-danger px-3 text-sm text-danger"
                >
                  Delete<span className="sr-only"> {p.title}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex flex-wrap gap-2">
          <Link
            href="/packs/edit"
            className="inline-flex min-h-11 items-center rounded-md bg-accent px-4 font-bold text-on-accent"
          >
            Make a new pack
          </Link>
          <button
            type="button"
            onClick={() => input.current?.click()}
            className="min-h-11 rounded-md border border-border-strong px-4"
          >
            Open a pack file
          </button>
          <input
            ref={input}
            type="file"
            accept=".json,application/json"
            className="sr-only"
            tabIndex={-1}
            aria-label="Choose a teacher pack file"
            onChange={async (e) => {
              const picked = e.target.files?.[0];
              e.target.value = "";
              if (!picked) return;
              const r = parsePack(await picked.text());
              if (!r.ok) return setMessage({ ok: false, text: r.error });
              await savePack(r.pack);
              setMine(await listPacks());
              setMessage({ ok: true, text: `Opened "${r.pack.title}".` });
            }}
          />
        </div>
        {message && (
          <p
            role={message.ok ? "status" : "alert"}
            className={message.ok ? "text-success" : "text-danger"}
          >
            {message.text}
          </p>
        )}
      </section>
    </div>
  );
}
