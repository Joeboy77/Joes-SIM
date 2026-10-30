"use client";

import { useCallback, useEffect } from "react";
import { runOffThread } from "./runner";
import { useSim, useSimState } from "./SimProvider";
import { SPEEDS } from "./speeds";

/** Runs timed ticks while playing. Mount once, in the simulator. */
export function usePlaybackLoop() {
  const store = useSim();
  const playing = useSimState((s) => s.playing);
  const speed = useSimState((s) => s.speed);

  useEffect(() => {
    if (!playing) return;
    let timer: ReturnType<typeof setTimeout>;
    const loop = () => {
      if (store.getState().tick())
        timer = setTimeout(loop, SPEEDS[store.getState().speed].interval);
    };
    timer = setTimeout(loop, SPEEDS[speed].interval);
    return () => clearTimeout(timer);
  }, [playing, speed, store]);
}

/** Run or pause: timed playback for animated speeds, the worker for instant runs. */
export function usePlayback() {
  const store = useSim();
  const toggle = useCallback(() => {
    const s = store.getState();
    if (s.playing) return s.pause();
    if (!s.state || s.state.status !== "ready") return;
    const from = s.state;
    if (s.speed === "instant") {
      s.setBusy(true);
      void runOffThread(from, { breakpoints: s.breakpoints }).then((r) => {
        // Ignore the result if the program changed while it ran.
        if (store.getState().state === from) store.getState().applyRun(r.state, r.reason, r.loop);
        else store.getState().setBusy(false);
      });
      return;
    }
    s.play();
    // Look ahead in the worker, so a loop that can never end is reported while it plays.
    void runOffThread(from, { maxSteps: 2_000_000 }).then((r) => {
      if (r.reason === "infinite-loop" && store.getState().playing)
        store.getState().setLoop(r.loop ?? null);
    });
  }, [store]);

  return { toggle };
}
