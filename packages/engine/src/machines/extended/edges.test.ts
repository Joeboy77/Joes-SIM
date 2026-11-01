/** Edge cases of the extended machine: device rules, error paths, analysis and disassembly. */
import { describe, expect, it } from "vitest";
import { analyse } from "../../analysis/detectors";
import { buildCfg } from "../../analysis/cfg";
import { assemble } from "../../assembler/assemble";
import { disassembleWord } from "../../assembler/disassemble";
import { run } from "../../core/run";
import { createState, machineOf, pressKey } from "../../core/state";
import { step } from "../../core/step";
import { Trace } from "../../insight/trace";
import { detectRuntime } from "../../insight/runtime";
import { appendConsole, createExtended, readPort, writePort } from "./devices";
import { encodeExt } from "./semantics";

const ext = (memory: number[], dialect: "classic" | "higginson" = "classic") =>
  createState({ memory, machine: "extended", dialect });
const fresh = () => createExtended([]);

describe("devices", () => {
  it("rejects keys out of order or out of range", () => {
    expect(() =>
      createExtended([], {
        keys: [
          { cycle: 5, key: 65 },
          { cycle: 2, key: 66 },
        ],
      }),
    ).toThrow(/cycle order/);
    expect(() => createExtended([], { keys: [{ cycle: 0, key: 200 }] })).toThrow(/Key code/);
  });

  it("reads each readable port", () => {
    let e = fresh();
    const w = writePort(e, 20, 5);
    if (w.ok) e = w.ext;
    expect(readPort(e, 21)).toMatchObject({ ok: true, value: 6, device: "timer" });
    expect(readPort(e, 11)).toMatchObject({ ok: true, value: 0 });
    expect(readPort(e, 3)).toMatchObject({ ok: true, value: 0 });
    expect(readPort(e, 50)).toMatchObject({ ok: true, value: 0, device: "interrupts" });
    expect(readPort(e, 2)).toMatchObject({ ok: true, value: 0 });
  });

  it("refuses to write a read-only port", () => {
    expect(writePort(fresh(), 2, 1)).toEqual({
      ok: false,
      message: "Port 02 (keyboard: the next key) can only be read with GET.",
    });
  });

  it("fills the display, lights raw segments and sets the note length", () => {
    let e = fresh();
    const fill = writePort(e, 12, 3);
    expect(fill.ok && fill.pixels?.length).toBe(256);
    if (fill.ok) e = fill.ext;
    const again = writePort(e, 12, 3);
    expect(again.ok && again.pixels).toEqual([]);
    const seg = writePort(e, 32, 0x7f);
    expect(seg.ok && seg.ext.devices.segments).toEqual([0, 0x7f, 0]);
    const len = writePort(e, 41, 7);
    expect(len.ok && len.ext.devices.noteLength).toBe(7);
    const silent = writePort(e, 40, 0);
    expect(silent.ok && silent.beep).toBeUndefined();
    expect(writePort(e, 1, 7)).toMatchObject({ ok: false });
  });

  it("writes new lines and clears the console", () => {
    expect(appendConsole("ab", 10)).toBe("ab\n");
    expect(appendConsole("ab", 12)).toBe("");
  });

  it("drops a key when the buffer is full", () => {
    const keys = Array.from({ length: 9 }, () => ({ cycle: 0, key: 65 }));
    const e = createExtended([], { keys });
    expect(e.devices.keyboard).toHaveLength(8);
    expect(e.keyIndex).toBe(9);
  });
});

describe("error paths", () => {
  it("RET to something that is not an address", () => {
    // LDA v; PUSH; RET; v DAT 150 (signed dialect)
    const r = run(ext([504, 410, 413, 0, 150], "higginson"));
    expect(r.state.error?.code).toBe("address-out-of-range");
    expect(r.state.error?.message).toContain("return address");
  });

  it("RTI with a damaged saved PC", () => {
    // Push 150, 0, 0 as if saved, then RTI.
    const r = run(ext([507, 410, 508, 410, 410, 442, 0, 150, 0], "higginson"));
    expect(r.state.error?.message).toContain("saved return address");
  });

  it("an address operand outside the mailboxes", () => {
    for (const code of [412, 414, 420, 430, 443]) {
      const r = run(ext([code, 150], "higginson"));
      expect(r.state.error?.code).toBe("address-out-of-range");
    }
  });

  it("an interrupt with no room on the stack", () => {
    // The program fills 00 to 98, so the stack has one mailbox (99): entry needs three.
    const memory = new Array<number>(99).fill(0);
    [443, 6, 506, 451, 20, 440].forEach((v, i) => (memory[i] = v));
    memory[6] = 1;
    memory[98] = 1;
    const r = run(createState({ memory, machine: "extended" }), { maxSteps: 50 });
    expect(r.state.error?.code).toBe("stack-overflow");
  });

  it("only the extended machine has a keyboard; finished machines ignore keys", () => {
    expect(() => pressKey(createState(), 65)).toThrow(/extended machine/);
    const halted = run(ext([0])).state;
    expect(pressKey(halted, 65)).toBe(halted);
    expect(machineOf(createState())).toBe("classic");
    expect(machineOf(ext([]))).toBe("extended");
    expect(() => encodeExt("PUSH", "indexed")).toThrow(/not an extended instruction/);
  });

  it("explains a machine error at the very first instruction", () => {
    const initial = ext([411]);
    const result = run(initial);
    const trace = new Trace(initial);
    trace.syncTo(result.state.cycles);
    const [f] = detectRuntime(trace, result.state);
    expect(f?.code).toBe("machine-error");
    expect(f?.hints[1]).toBe("It was the first instruction the program ran.");
  });

  it("micro-steps report waiting for a key", () => {
    const waiting = run(ext([440, 444])).state;
    const r = step(waiting, { granularity: "micro" });
    expect(r.state).toBe(waiting);
    expect(r.steps[0]?.events).toEqual([{ type: "wait", idle: true }]);
  });
});

describe("analysis and disassembly", () => {
  const program = (source: string) => {
    const r = assemble(source, { machine: "extended", dialect: "higginson" });
    if (!r.program) throw new Error(JSON.stringify(r.diagnostics));
    return r.program;
  };

  it("treats invalid 4xx words as stops, and builds edges into a subroutine", () => {
    const cfg = buildCfg([405, 0], "classic", true);
    expect(cfg.blocks[0]?.exit).toBe("invalid");
    const p = program("        CALL s\n        HLT\ns       RET");
    const graph = buildCfg(p.memory, p.dialect, true);
    expect(graph.edges.map((e) => e.kind).sort()).toEqual(["call", "fallthrough"]);
  });

  it("knows STX gives a mailbox a value and LDX reads one", () => {
    const codes = (src: string) => analyse(program(src)).map((f) => f.code);
    expect(codes("        LDX n\n        HLT\nn       DAT")).toContain("uninitialised-read");
    expect(
      codes("        INX\n        STX n\n        LDX n\n        HLT\nn       DAT"),
    ).not.toContain("uninitialised-read");
    // A store through an index could reach any mailbox, so reads are not reported.
    expect(
      codes("        LDA n\n        STA t,X\n        HLT\nn       DAT\nt       DAT"),
    ).not.toContain("uninitialised-read");
  });

  it("reports a subroutine without RET once, however often it is called", () => {
    const findings = analyse(program("        CALL s\n        CALL s\n        HLT\ns       HLT"));
    expect(findings.filter((f) => f.code === "call-without-ret")).toHaveLength(1);
  });

  it("shows a two-mailbox instruction without its address when the next mailbox is unknown", () => {
    expect(disassembleWord(412, "classic", { machine: "extended" }).text).toBe("CALL ?");
  });
});
