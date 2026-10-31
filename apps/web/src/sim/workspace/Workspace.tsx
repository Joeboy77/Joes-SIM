"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { fromLmc } from "@/storage/files";
import {
  createFile,
  deleteFile,
  duplicateFile,
  getCurrentFileId,
  getFile,
  listFiles,
  renameFile,
  saveFile,
  setCurrentFileId,
  uniqueName,
  type WorkspaceFile,
} from "@/storage/workspace";
import { useSim } from "../SimProvider";
import { STARTER_PROGRAM } from "../store";
import { readHandoff, type Handoff } from "./handoff";
import { decodeShare } from "./share";

export type SaveStatus = "loading" | "saving" | "saved" | "scratch" | "error";

interface WorkspaceApi {
  readonly file: WorkspaceFile | null;
  readonly files: readonly WorkspaceFile[];
  readonly status: SaveStatus;
  /** Set when the program came from a link and is not saved yet. */
  readonly scratch: Handoff | null;
  open(id: string): Promise<void>;
  create(): Promise<void>;
  rename(id: string, name: string): Promise<void>;
  duplicate(id: string): Promise<void>;
  remove(id: string): Promise<void>;
  importLmc(name: string, text: string): Promise<void>;
  saveScratch(): Promise<void>;
}

const Ctx = createContext<WorkspaceApi | null>(null);

export function useWorkspace(): WorkspaceApi {
  const api = useContext(Ctx);
  if (!api) throw new Error("useWorkspace must be used inside <WorkspaceProvider>");
  return api;
}

const SAVE_DELAY = 400;

/**
 * Keeps the simulator and the current workspace file in step: opens the last file on load and
 * saves the source, dialect and inputs a moment after each change.
 */
export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const store = useSim();
  const [file, setFile] = useState<WorkspaceFile | null>(null);
  const [files, setFiles] = useState<WorkspaceFile[]>([]);
  const [status, setStatus] = useState<SaveStatus>("loading");
  const [scratch, setScratch] = useState<Handoff | null>(null);
  const current = useRef<WorkspaceFile | null>(null);
  const loading = useRef(true);

  const refresh = useCallback(async () => setFiles(await listFiles()), []);

  const show = useCallback(
    (f: WorkspaceFile) => {
      loading.current = true;
      current.current = f;
      setFile(f);
      const s = store.getState();
      s.setDialect(f.dialect);
      s.setInputText(f.inputs);
      s.setSource(f.source);
      loading.current = false;
      setStatus("saved");
    },
    [store],
  );

  // Open on load: a program from a link, else the last file, else a first file.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const shared = decodeShare(new URLSearchParams(window.location.search).get("p"));
        const handoff: Handoff | null = shared
          ? {
              name: shared.name || "Shared program",
              source: shared.source,
              dialect: shared.dialect,
              inputs: shared.inputs,
              cycle: 0,
            }
          : readHandoff(window.location.hash);
        if (handoff) {
          // A share link stays in the address bar, so reloading reopens it; a challenge link does not.
          if (!shared) history.replaceState(null, "", window.location.pathname);
          const s = store.getState();
          if (shared) s.setView(shared.view);
          s.setDialect(handoff.dialect);
          s.setInputText(handoff.inputs);
          s.setSource(handoff.source);
          if (handoff.cycle > 0) s.goToCycle(handoff.cycle);
          current.current = null;
          loading.current = false;
          setScratch(handoff);
          setStatus("scratch");
          await refresh();
          return;
        }
        const id = await getCurrentFileId();
        let f = id ? await getFile(id) : undefined;
        if (!f) f = (await listFiles())[0];
        if (!f) {
          f = await createFile({
            name: "My first program",
            source: STARTER_PROGRAM,
            dialect: "classic",
            inputs: "3, 4",
          });
        }
        if (cancelled) return;
        await setCurrentFileId(f.id);
        show(f);
        await refresh();
      } catch {
        // IndexedDB can be unavailable (private windows in some browsers). The simulator works.
        loading.current = false;
        setStatus("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [store, show, refresh]);

  // Save a moment after the program, dialect or inputs change, and at once if the page is hidden
  // or closed, so the last edit is never lost.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const save = () => {
      timer = null;
      const f = current.current;
      if (!f) return;
      const { source, dialect, inputText } = store.getState();
      const next = { ...f, source, dialect, inputs: inputText, updated: Date.now() };
      current.current = next;
      void saveFile(next)
        .then(() => {
          setFile(next);
          setStatus("saved");
        })
        .catch(() => setStatus("error"));
    };
    const flush = () => {
      if (!timer) return;
      clearTimeout(timer);
      save();
    };
    const onHide = () => {
      if (document.visibilityState === "hidden") flush();
    };
    const unsubscribe = store.subscribe((s, prev) => {
      if (loading.current || !current.current) return;
      if (s.source === prev.source && s.dialect === prev.dialect && s.inputText === prev.inputText)
        return;
      setStatus("saving");
      if (timer) clearTimeout(timer);
      timer = setTimeout(save, SAVE_DELAY);
    });
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      unsubscribe();
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onHide);
      flush();
    };
  }, [store]);

  const open = useCallback(
    async (id: string) => {
      const f = await getFile(id);
      if (!f) return;
      await setCurrentFileId(id);
      setScratch(null);
      show(f);
    },
    [show],
  );

  const api: WorkspaceApi = {
    file,
    files,
    status,
    scratch,
    open,
    async create() {
      const f = await createFile({
        name: uniqueName("Untitled", await listFiles()),
        source: "        HLT\n",
        dialect: store.getState().dialect,
        inputs: "",
      });
      await refresh();
      await open(f.id);
    },
    async rename(id, name) {
      const f = await renameFile(id, name);
      if (f && current.current?.id === id) {
        current.current = f;
        setFile(f);
      }
      await refresh();
    },
    async duplicate(id) {
      const f = await duplicateFile(id);
      await refresh();
      if (f) await open(f.id);
    },
    async remove(id) {
      await deleteFile(id);
      const rest = await listFiles();
      setFiles(rest);
      if (current.current?.id !== id) return;
      if (rest[0]) await open(rest[0].id);
      else await api.create();
    },
    async importLmc(name, text) {
      const { source, dialect } = fromLmc(text, store.getState().dialect);
      const f = await createFile({
        name: uniqueName(name.replace(/\.[^.]+$/, "") || "Imported", await listFiles()),
        source,
        dialect,
        inputs: "",
      });
      await refresh();
      await open(f.id);
    },
    async saveScratch() {
      const { source, dialect, inputText } = store.getState();
      const f = await createFile({
        name: uniqueName(scratch?.name ?? "Opened program", await listFiles()),
        source,
        dialect,
        inputs: inputText,
      });
      await setCurrentFileId(f.id);
      current.current = f;
      setFile(f);
      setScratch(null);
      setStatus("saved");
      history.replaceState(null, "", window.location.pathname);
      await refresh();
    },
  };

  // Show the simulator once the learner's work has loaded, so nothing they do is overwritten by
  // the load. IndexedDB answers in a few milliseconds.
  return (
    <Ctx.Provider value={api}>
      {status === "loading" ? (
        <p className="p-6 text-muted" role="status">
          Opening your work…
        </p>
      ) : (
        children
      )}
    </Ctx.Provider>
  );
}
