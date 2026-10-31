"use client";

import { useEffect, useId, useRef, useState } from "react";
import { downloadText } from "@/storage/backup";
import { lmcFileName, toLmc } from "@/storage/files";
import { useSimState } from "../SimProvider";
import { useWorkspace } from "./Workspace";

const STATUS: Record<string, string> = {
  loading: "Opening…",
  saving: "Saving…",
  saved: "Saved on this device",
  scratch: "Not saved",
  error: "Cannot save in this browser",
};

/** The current file's name and save state, and a dialog for managing files. */
export function FilesMenu() {
  const ws = useWorkspace();
  const source = useSimState((s) => s.source);
  const dialect = useSimState((s) => s.dialect);
  const [open, setOpen] = useState(false);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [name, setName] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const renameId = useId();

  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  const title = ws.scratch ? ws.scratch.name : (ws.file?.name ?? "…");

  return (
    <>
      <div className="flex min-w-0 items-center gap-2">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="min-h-11 max-w-[16rem] truncate rounded-md border border-border-strong bg-surface px-3 text-sm font-bold"
        >
          <span aria-hidden="true">📄 </span>
          {title}
          <span className="sr-only">: manage files</span>
        </button>
        <span className="hidden text-xs text-muted sm:inline">{STATUS[ws.status]}</span>
        {ws.scratch && (
          <button
            type="button"
            onClick={() => void ws.saveScratch()}
            className="min-h-11 rounded-md border border-accent px-3 text-sm font-bold text-accent"
          >
            Save as a file
          </button>
        )}
      </div>

      <dialog
        ref={dialog}
        onClose={() => {
          setOpen(false);
          setRenaming(null);
        }}
        aria-labelledby="files-title"
        className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-lg border border-border-strong bg-surface p-5 text-text backdrop:bg-black/50"
      >
        <h2 id="files-title" className="mb-1 text-lg font-bold">
          Your files
        </h2>
        <p className="mb-3 text-sm text-muted">
          Saved in this browser as you type. Nothing leaves your device. Back up everything from the
          Progress page.
        </p>
        <ul className="max-h-[50vh] space-y-1 overflow-auto">
          {ws.files.map((f) => {
            const isCurrent = !ws.scratch && f.id === ws.file?.id;
            return (
              <li
                key={f.id}
                className={`rounded-sm border p-2 ${isCurrent ? "border-accent" : "border-border"}`}
              >
                {renaming === f.id ? (
                  <form
                    className="flex flex-wrap items-end gap-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void ws.rename(f.id, name).then(() => setRenaming(null));
                    }}
                  >
                    <div className="grow">
                      <label htmlFor={renameId} className="block text-xs text-muted">
                        New name
                      </label>
                      <input
                        id={renameId}
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        autoFocus
                        className="min-h-11 w-full rounded-sm border border-border-strong bg-surface px-2"
                      />
                    </div>
                    <button className="min-h-11 rounded-sm bg-accent px-3 font-bold text-on-accent">
                      Save name
                    </button>
                    <button
                      type="button"
                      onClick={() => setRenaming(null)}
                      className="min-h-11 rounded-sm border border-border-strong px-3"
                    >
                      Cancel
                    </button>
                  </form>
                ) : (
                  <div className="flex flex-wrap items-center gap-1">
                    <button
                      type="button"
                      aria-current={isCurrent ? "true" : undefined}
                      onClick={() => void ws.open(f.id).then(() => setOpen(false))}
                      className="min-h-11 grow truncate rounded-sm px-2 text-start font-bold text-accent underline-offset-4 hover:underline"
                    >
                      {f.name}
                      {isCurrent && <span className="font-normal text-muted"> (open)</span>}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setRenaming(f.id);
                        setName(f.name);
                      }}
                      aria-label={`Rename ${f.name}`}
                      className="min-h-11 rounded-sm border border-border-strong px-2 text-sm"
                    >
                      Rename
                    </button>
                    <button
                      type="button"
                      onClick={() => void ws.duplicate(f.id)}
                      aria-label={`Duplicate ${f.name}`}
                      className="min-h-11 rounded-sm border border-border-strong px-2 text-sm"
                    >
                      Duplicate
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm(`Delete "${f.name}"? This cannot be undone.`))
                          void ws.remove(f.id);
                      }}
                      aria-label={`Delete ${f.name}`}
                      className="min-h-11 rounded-sm border border-danger px-2 text-sm text-danger"
                    >
                      Delete
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void ws.create().then(() => setOpen(false))}
            className="min-h-11 rounded-md bg-accent px-3 font-bold text-on-accent"
          >
            New file
          </button>
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            className="min-h-11 rounded-md border border-border-strong px-3"
          >
            Import .lmc
          </button>
          <button
            type="button"
            onClick={() =>
              downloadText(lmcFileName(title), toLmc({ source, dialect }), "text/plain")
            }
            className="min-h-11 rounded-md border border-border-strong px-3"
          >
            Export this program (.lmc)
          </button>
          <input
            ref={fileInput}
            type="file"
            accept=".lmc,.txt,text/plain"
            className="sr-only"
            tabIndex={-1}
            aria-label="Choose an .lmc file to import"
            onChange={async (e) => {
              const picked = e.target.files?.[0];
              if (!picked) return;
              await ws.importLmc(picked.name, await picked.text());
              e.target.value = "";
              setOpen(false);
            }}
          />
          <form method="dialog" className="ms-auto">
            <button className="min-h-11 rounded-md border border-border-strong px-3">Close</button>
          </form>
        </div>
      </dialog>
    </>
  );
}
