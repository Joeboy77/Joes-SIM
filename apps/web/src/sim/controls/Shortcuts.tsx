"use client";

import { useEffect, useRef, useState } from "react";
import { usePlayback } from "../usePlayback";
import { VIEW_ORDER } from "../store";
import { useSim } from "../SimProvider";
import { useWorkspaceLoading } from "../workspace/Workspace";

export const SHORTCUTS: readonly [string, string][] = [
  ["P or Ctrl+Enter", "Run or pause"],
  ["S", "Step one instruction"],
  ["Shift+S", "Step back one instruction"],
  ["M", "Step one micro-step"],
  ["Shift+M", "Step back one micro-step"],
  ["R", "Reset"],
  ["V", "Switch view: datapath, story, flow graph"],
  ["F", "Presentation mode (bigger everything)"],
  ["?", "Show this help"],
];

function typing(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) ||
    !!target.closest(".cm-editor")
  );
}

/** Global keyboard shortcuts, and the help sheet shown with "?". */
export function Shortcuts() {
  const store = useSim();
  const { toggle } = usePlayback();
  const [open, setOpen] = useState(false);
  const loading = useWorkspaceLoading();
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (loading) return;
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        toggle();
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey || typing(e.target)) return;
      const a = store.getState();
      const busy = a.playing;
      const actions: Record<string, () => void> = {
        p: toggle,
        s: () => !busy && a.stepInstruction(),
        S: () => !busy && a.backInstruction(),
        m: () => !busy && a.stepMicro(),
        M: () => !busy && a.back(),
        r: () => a.reset(),
        v: () =>
          a.setView(VIEW_ORDER[(VIEW_ORDER.indexOf(a.view) + 1) % VIEW_ORDER.length] ?? "datapath"),
        f: () => a.togglePresentation(),
        "?": () => setOpen(true),
      };
      const action = actions[e.key];
      if (action) {
        e.preventDefault();
        action();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [store, toggle, loading]);

  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-keyshortcuts="?"
        className="min-h-11 rounded-md border border-border-strong bg-surface px-3 text-sm font-bold whitespace-nowrap"
      >
        Keys <span aria-hidden="true">?</span>
      </button>
      <dialog
        ref={dialog}
        onClose={() => setOpen(false)}
        aria-labelledby="shortcuts-title"
        className="m-auto max-w-md rounded-lg border border-border-strong bg-surface p-5 text-text backdrop:bg-black/50"
      >
        <h2 id="shortcuts-title" className="mb-3 text-lg font-bold">
          Keyboard shortcuts
        </h2>
        <table className="w-full text-sm">
          <tbody>
            {SHORTCUTS.map(([keys, what]) => (
              <tr key={keys} className="border-b border-border">
                <th scope="row" className="py-1.5 pe-4 text-start font-mono font-normal">
                  {keys}
                </th>
                <td className="py-1.5">{what}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-3 text-sm text-muted">
          Shortcuts work when you are not typing in the editor or a box. Ctrl+Enter works
          everywhere.
        </p>
        <form method="dialog" className="mt-4 text-end">
          <button className="min-h-11 rounded-md bg-accent px-4 font-bold text-on-accent">
            Close
          </button>
        </form>
      </dialog>
    </>
  );
}
