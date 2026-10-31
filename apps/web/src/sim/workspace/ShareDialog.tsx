"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useSimState } from "../SimProvider";
import { LONG_LINK, sharePath } from "./share";
import { useWorkspace } from "./Workspace";

/** Makes a link that opens this exact program, inputs, dialect and view. */
export function ShareButton() {
  const ws = useWorkspace();
  const source = useSimState((s) => s.source);
  const dialect = useSimState((s) => s.dialect);
  const inputs = useSimState((s) => s.inputText);
  const view = useSimState((s) => s.view);
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const linkId = useId();
  const titleId = useId();

  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  const name = ws.scratch?.name ?? ws.file?.name ?? "";
  const link =
    typeof window === "undefined"
      ? ""
      : `${window.location.origin}${sharePath({ name, source, dialect, inputs, view })}`;

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setCopied(false);
          setOpen(true);
        }}
        className="min-h-11 rounded-md border border-border-strong bg-surface px-3 text-sm font-bold whitespace-nowrap"
      >
        Share
      </button>
      <dialog
        ref={dialog}
        onClose={() => setOpen(false)}
        aria-labelledby={titleId}
        className="m-auto w-[min(34rem,calc(100vw-2rem))] rounded-lg border border-border-strong bg-surface p-5 text-text backdrop:bg-black/50"
      >
        <h2 id={titleId} className="mb-1 text-lg font-bold">
          Share this program
        </h2>
        <p className="mb-3 text-sm text-muted">
          The link holds the program, its inputs, the dialect and the view. Nothing is uploaded:
          anyone with the link sees exactly what you see now.
        </p>
        <label htmlFor={linkId} className="block text-sm font-bold">
          Link
        </label>
        <input
          id={linkId}
          readOnly
          value={link}
          onFocus={(e) => e.target.select()}
          className="min-h-11 w-full rounded-sm border border-border-strong bg-surface-2 px-2 font-mono text-xs"
        />
        {link.length > LONG_LINK && (
          <p className="mt-1 text-sm text-write">
            This link is long, so some apps may cut it off. Sharing the .lmc file is safer for long
            programs.
          </p>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={async () => {
              await navigator.clipboard.writeText(link).catch(() => undefined);
              setCopied(true);
            }}
            className="min-h-11 rounded-md bg-accent px-4 font-bold text-on-accent"
          >
            Copy link
          </button>
          {typeof navigator !== "undefined" && "share" in navigator && (
            <button
              type="button"
              onClick={() =>
                void navigator
                  .share({ title: name || "A Little Man Computer program", url: link })
                  .catch(() => undefined)
              }
              className="min-h-11 rounded-md border border-border-strong px-4"
            >
              Share to an app
            </button>
          )}
          <form method="dialog" className="ms-auto">
            <button className="min-h-11 rounded-md border border-border-strong px-4">Close</button>
          </form>
        </div>
        <p role="status" className="mt-2 min-h-6 text-sm text-success">
          {copied ? "Link copied." : ""}
        </p>
      </dialog>
    </>
  );
}
