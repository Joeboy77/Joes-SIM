"use client";

import { DISPLAY_SIZE, KEYBOARD_SIZE, type Devices as DeviceState } from "@joes-sim/engine";
import { useEffect, useId, useRef, useState } from "react";
import { useSim, useSimState } from "../SimProvider";
import { useActivity } from "../useActivity";
import { PALETTE, describeDisplay, keyCode, keyName, segmentText } from "./model";

/** The virtual devices, updated live as the program runs. */
export function Devices() {
  const devices = useSimState((s) => s.state?.ext?.devices);
  if (!devices) return null;
  return (
    <section aria-label="Devices" className="space-y-3">
      <h2 className="text-sm font-bold">Devices</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <PixelDisplay pixels={devices.pixels} />
        <div className="space-y-3">
          <SevenSegment segments={devices.segments} minus={devices.minus} />
          <Timer devices={devices} />
          <Beeper note={devices.note} />
        </div>
        <Console text={devices.console} />
        <Keyboard buffer={devices.keyboard} />
      </div>
    </section>
  );
}

function Device({
  title,
  port,
  children,
}: {
  title: string;
  port: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-sm border border-border bg-surface p-2">
      <h3 className="mb-1 flex justify-between gap-2 text-xs font-bold">
        <span>{title}</span>
        <span className="font-normal text-muted">{port}</span>
      </h3>
      {children}
    </div>
  );
}

/** 16 by 16 pixels. Only the pixels that changed are redrawn. */
function PixelDisplay({ pixels }: { pixels: readonly number[] }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const drawn = useRef<readonly number[] | null>(null);

  useEffect(() => {
    const ctx = canvas.current?.getContext("2d");
    if (!ctx) return;
    const before = drawn.current;
    for (let i = 0; i < pixels.length; i++) {
      const c = pixels[i] ?? 0;
      if (before && before[i] === c) continue;
      ctx.fillStyle = PALETTE[c]?.hex ?? "#000000";
      ctx.fillRect(i % DISPLAY_SIZE, Math.floor(i / DISPLAY_SIZE), 1, 1);
    }
    drawn.current = pixels;
  }, [pixels]);

  return (
    <Device title="Pixel display" port="ports 10, 11, 12">
      <canvas
        ref={canvas}
        width={DISPLAY_SIZE}
        height={DISPLAY_SIZE}
        role="img"
        aria-label={describeDisplay(pixels)}
        className="aspect-square w-full max-w-64 rounded-sm border border-border-strong"
        style={{ imageRendering: "pixelated" }}
      />
    </Device>
  );
}

/** Three digits of seven segments each, drawn from the segment bits. */
function SevenSegment({ segments, minus }: { segments: readonly number[]; minus: boolean }) {
  const text = segmentText(segments, minus);
  // Segment a to g as bars inside a 40 by 70 digit.
  const BARS: readonly [number, number, number, number][] = [
    [6, 2, 28, 6], // a
    [32, 6, 6, 27], // b
    [32, 37, 6, 27], // c
    [6, 62, 28, 6], // d
    [2, 37, 6, 27], // e
    [2, 6, 6, 27], // f
    [6, 32, 28, 6], // g
  ];
  return (
    <Device title="Seven-segment" port="ports 30 to 33">
      <svg
        viewBox="0 0 160 72"
        className="h-14 w-auto"
        role="img"
        aria-label={`Seven-segment display: ${text.trim() || "blank"}`}
      >
        <rect x={0} y={0} width={160} height={72} rx={6} fill="#111" />
        <rect x={6} y={33} width={18} height={6} fill={minus ? "#ff5a4f" : "#2a1714"} />
        {segments.map((bits, d) => (
          <g key={d} transform={`translate(${28 + d * 44} 2)`}>
            {BARS.map(([x, y, w, h], b) => (
              <rect
                key={b}
                x={x}
                y={y}
                width={w}
                height={h}
                rx={2}
                fill={bits & (1 << b) ? "#ff5a4f" : "#2a1714"}
              />
            ))}
          </g>
        ))}
      </svg>
    </Device>
  );
}

function Timer({ devices }: { devices: DeviceState }) {
  return (
    <Device title="Timer" port="ports 20, 21">
      <p className="text-sm">
        {devices.timerPeriod === 0
          ? "Off."
          : `Every ${devices.timerPeriod} instructions; next tick in ${devices.timerLeft}.`}
      </p>
    </Device>
  );
}

/** Plays notes with Web Audio, only when the learner has turned sound on. */
function Beeper({ note }: { note: number }) {
  const [on, setOn] = useState(false);
  const audio = useRef<AudioContext | null>(null);
  const { activity } = useActivity();
  const lastSteps = useSimState((s) => s.lastSteps);
  const direction = useSimState((s) => s.direction);

  useEffect(() => {
    if (!on || direction !== "forward") return;
    for (const e of lastSteps.flatMap((s) => s.events)) {
      if (e.type !== "beep") continue;
      const ctx = (audio.current ??= new AudioContext());
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      // Piano key 49 is A above middle C, 440 Hz.
      osc.frequency.value = 440 * 2 ** ((e.note - 49) / 12);
      gain.gain.value = 0.08;
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + e.length / 10);
    }
  }, [lastSteps, direction, on]);

  return (
    <Device title="Beeper" port="ports 40, 41">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <span>
          {note ? `Last note: ${note}` : "Silent."}
          {activity.devicePort === 40 ? " ♪" : ""}
        </span>
        <button
          type="button"
          aria-pressed={on}
          onClick={() => setOn(!on)}
          className={`min-h-11 rounded-sm border px-3 ${on ? "border-accent bg-accent font-bold text-on-accent" : "border-border-strong bg-surface"}`}
        >
          Sound
        </button>
      </div>
    </Device>
  );
}

function Console({ text }: { text: string }) {
  return (
    <Device title="Console" port="port 01">
      <pre
        tabIndex={0}
        aria-label={`Console: ${text ? text : "empty"}`}
        className="min-h-24 overflow-x-auto rounded-sm bg-[#111] p-2 font-mono text-sm leading-snug whitespace-pre text-[#e6ffe6]"
      >
        {text || " "}
      </pre>
    </Device>
  );
}

/** Type here to press keys on the machine's keyboard. */
function Keyboard({ buffer }: { buffer: readonly number[] }) {
  const store = useSim();
  const status = useSimState((s) => s.state?.status);
  const waiting = status === "waiting-interrupt";
  const id = useId();
  return (
    <Device title="Keyboard" port="ports 02, 03">
      <label htmlFor={id} className="mb-1 block text-sm">
        {waiting ? "The program is waiting for a key. " : ""}Click here and type:
      </label>
      <input
        id={id}
        value=""
        readOnly
        autoComplete="off"
        onKeyDown={(e) => {
          if (e.ctrlKey || e.metaKey || e.altKey) return;
          const code = keyCode(e.key);
          if (code === null) return;
          e.preventDefault();
          store.getState().pressKey(code);
        }}
        className={`min-h-11 w-full rounded-sm border bg-surface px-2 font-mono text-sm ${waiting ? "border-2 border-accent" : "border-border-strong"}`}
        placeholder="Keys go to the keyboard buffer"
      />
      <p className="mt-1 text-xs text-muted" aria-live="polite">
        Buffer ({buffer.length} of {KEYBOARD_SIZE}):{" "}
        {buffer.length ? buffer.map(keyName).join(" ") : "empty"}
      </p>
    </Device>
  );
}
