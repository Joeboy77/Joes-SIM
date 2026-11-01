import {
  DIALECTS,
  DIALECT_IDS,
  PORTS,
  encode,
  encodeExt,
  type AddressMode,
  type ExtMnemonic,
  type Mnemonic,
} from "@joes-sim/engine";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Instruction reference",
  description:
    "Every Little Man Computer instruction in Joe's SIM, with its machine code, what it does, and how the Classic, Higginson-compatible and OCR dialects differ.",
};

const INSTRUCTIONS: { m: Mnemonic; operand: boolean; does: string; flag: string }[] = [
  {
    m: "ADD",
    operand: true,
    does: "Adds the number in mailbox xx to the accumulator.",
    flag: "Classic clears the negative flag; signed dialects set it if the result is below zero.",
  },
  {
    m: "SUB",
    operand: true,
    does: "Subtracts the number in mailbox xx from the accumulator.",
    flag: "Sets the negative flag when the result goes below zero.",
  },
  {
    m: "STA",
    operand: true,
    does: "Stores the accumulator in mailbox xx. The accumulator keeps its value.",
    flag: "No change.",
  },
  {
    m: "LDA",
    operand: true,
    does: "Loads the number in mailbox xx into the accumulator.",
    flag: "Classic clears it; signed dialects set it for a negative value.",
  },
  {
    m: "BRA",
    operand: true,
    does: "Branches: the next instruction comes from mailbox xx.",
    flag: "No change.",
  },
  {
    m: "BRZ",
    operand: true,
    does: "Branches to xx if the accumulator is zero.",
    flag: "Classic also needs the flag clear.",
  },
  {
    m: "BRP",
    operand: true,
    does: "Branches to xx if the accumulator is zero or positive (the negative flag is clear).",
    flag: "Reads the flag.",
  },
  {
    m: "INP",
    operand: false,
    does: "Takes the next number from the input tray into the accumulator.",
    flag: "As for LDA.",
  },
  {
    m: "OUT",
    operand: false,
    does: "Copies the accumulator to the output tray as a number.",
    flag: "No change.",
  },
  {
    m: "OTC",
    operand: false,
    does: "Copies the accumulator to the output tray as a character (its character code).",
    flag: "No change.",
  },
  { m: "HLT", operand: false, does: "Stops the machine.", flag: "No change." },
];

/** The extended machine's instructions (docs/specs/extended.md). */
const EXTENDED: {
  m: ExtMnemonic | "LDA" | "STA" | "ADD" | "SUB";
  mode?: AddressMode;
  written: string;
  does: string;
}[] = [
  {
    m: "PUSH",
    written: "PUSH",
    does: "SP goes down by one; the accumulator is put on top of the stack.",
  },
  {
    m: "POP",
    written: "POP",
    does: "The top of the stack goes into the accumulator; SP goes up by one.",
  },
  {
    m: "CALL",
    written: "CALL a",
    does: "Pushes the return address (the next instruction) and goes to the subroutine at a.",
  },
  { m: "RET", written: "RET", does: "Pops the return address into the program counter." },
  { m: "LDX", written: "LDX a", does: "Loads the index register X from mailbox a." },
  { m: "STX", written: "STX a", does: "Stores X in mailbox a." },
  { m: "INX", written: "INX", does: "Adds one to X." },
  { m: "DEX", written: "DEX", does: "Takes one from X." },
  {
    m: "LDA",
    mode: "indirect",
    written: "LDA @a",
    does: "Indirect: loads from the mailbox whose address is in mailbox a. STA, ADD and SUB work the same way (421 to 423).",
  },
  {
    m: "LDA",
    mode: "indexed",
    written: "LDA a,X",
    does: "Indexed: loads from mailbox a + X. STA, ADD and SUB work the same way (431 to 433).",
  },
  { m: "EI", written: "EI", does: "Turns interrupts on." },
  { m: "DI", written: "DI", does: "Turns interrupts off." },
  {
    m: "RTI",
    written: "RTI",
    does: "Returns from an interrupt: pops the flag, the accumulator and the program counter, and turns interrupts back on.",
  },
  { m: "VEC", written: "VEC a", does: "Interrupts will run the handler at mailbox a." },
  {
    m: "WAIT",
    written: "WAIT",
    does: "Waits until an interrupt is pending. An error if interrupts are off.",
  },
  { m: "GET", written: "GET p", does: "Reads device port p into the accumulator." },
  { m: "PUT", written: "PUT p", does: "Sends the accumulator to device port p." },
];

const PORT_DETAILS: Record<number, string> = {
  1: "Shows the character with this code (32 to 126); 10 starts a new line, 12 clears.",
  2: "The next key code from the buffer, or 0 if it is empty.",
  3: "How many keys are waiting (0 to 8).",
  10: "Chooses a pixel, 0 to 255 (row × 16 + column).",
  11: "PUT colours the chosen pixel (0 to 15) and moves to the next; GET reads its colour.",
  12: "Fills the whole display with a colour (0 to 15).",
  20: "A timer interrupt every n instructions (1 to 999); 0 turns the timer off.",
  21: "Instructions left until the next tick.",
  30: "Shows a number, −999 to 999.",
  31: "Lights segments of digit 1 directly (0 to 127, bit 0 is segment a).",
  32: "Lights segments of digit 2.",
  33: "Lights segments of digit 3.",
  40: "Plays a note, 1 to 88 (piano keys; 49 is A above middle C); 0 is silence.",
  41: "Length of the next notes, in tenths of a second (1 to 20).",
  50: "What caused the last interrupt: 1 timer, 2 keyboard.",
};

const code = (m: Mnemonic, operand: boolean) => {
  const n = encode(m, 0);
  if (!operand) return String(n).padStart(3, "0");
  return `${Math.floor(n / 100)}xx`;
};

export default function ReferencePage() {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">Instruction reference</h1>
        <p className="max-w-2xl">
          Every instruction is a three-digit number: the first digit says what to do and the last
          two say which mailbox. In your programs you write the mnemonic; the assembler turns it
          into the number. Write{" "}
          <code className="rounded-sm bg-surface-2 px-1 font-mono">name DAT 5</code> to fill a
          mailbox with data, and give any line a label to name its mailbox.
        </p>
      </div>

      {/* A wide table scrolls inside its own box on narrow screens, never the whole page. */}
      <div
        className="overflow-x-auto"
        role="region"
        aria-label="Instructions, scrollable"
        tabIndex={0}
      >
        <table className="w-full min-w-[40rem] border-collapse text-sm">
          <caption className="mb-2 text-start text-lg font-bold">Instructions</caption>
          <thead>
            <tr className="text-start">
              <th scope="col" className="border-b-2 border-border-strong p-2">
                Code
              </th>
              <th scope="col" className="border-b-2 border-border-strong p-2">
                Mnemonic
              </th>
              <th scope="col" className="border-b-2 border-border-strong p-2">
                What it does
              </th>
              <th scope="col" className="border-b-2 border-border-strong p-2">
                Negative flag
              </th>
              <th scope="col" className="border-b-2 border-border-strong p-2">
                Dialects
              </th>
            </tr>
          </thead>
          <tbody>
            {INSTRUCTIONS.map(({ m, operand, does, flag }) => (
              <tr key={m}>
                <td className="border-b border-border p-2 font-mono">{code(m, operand)}</td>
                <th scope="row" className="border-b border-border p-2 text-start font-mono">
                  {m}
                  {operand ? " xx" : ""}
                </th>
                <td className="border-b border-border p-2">{does}</td>
                <td className="border-b border-border p-2">{flag}</td>
                <td className="border-b border-border p-2">
                  {DIALECT_IDS.filter((d) => Object.values(DIALECTS[d].spellings).includes(m))
                    .map((d) => DIALECTS[d].name)
                    .join(", ")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <section aria-labelledby="dialects-h" className="space-y-4">
        <h2 id="dialects-h" className="text-2xl font-bold">
          Dialects
        </h2>
        <p className="max-w-2xl">
          Textbooks, exam boards and simulators disagree on a few edge cases. Pick the dialect your
          course uses in the simulator&apos;s settings; it is always shown on screen and saved in
          share links.
        </p>
        <div className="grid gap-4 md:grid-cols-3">
          {DIALECT_IDS.map((id) => {
            const d = DIALECTS[id];
            const spellings = Object.entries(d.spellings).filter(([s, m]) => s !== m);
            return (
              <section
                key={id}
                aria-labelledby={`d-${id}`}
                className="space-y-2 rounded-md border border-border bg-surface p-3 text-sm"
              >
                <h3 id={`d-${id}`} className="text-lg font-bold">
                  {d.name}
                </h3>
                <p>{d.summary}</p>
                <dl className="space-y-1">
                  <dt className="font-bold">Values</dt>
                  <dd>
                    {d.minValue} to {d.maxValue}; results that do not fit{" "}
                    {d.arithmetic === "unsigned-wrap"
                      ? "wrap round modulo 1000"
                      : "wrap round, keeping their sign"}
                    .
                  </dd>
                  <dt className="font-bold">BRZ</dt>
                  <dd>
                    {d.brzRequiresFlagClear
                      ? "Branches when the accumulator is zero and the negative flag is clear."
                      : "Branches when the accumulator is zero."}
                  </dd>
                  <dt className="font-bold">Missing address</dt>
                  <dd>
                    {d.missingOperand === "error"
                      ? "An error: every instruction that needs an address must have one."
                      : "Treated as 00, with a warning."}
                  </dd>
                  <dt className="font-bold">Other spellings</dt>
                  <dd>
                    {spellings.length
                      ? spellings.map(([s, m]) => `${s} for ${m}`).join(", ")
                      : "None"}
                  </dd>
                </dl>
              </section>
            );
          })}
        </div>
        <p className="text-sm text-muted">
          Each rule and its source are in the project&apos;s{" "}
          <a
            href="https://github.com/Joeboy77/Joes-SIM/tree/main/docs/specs/dialects"
            className="text-accent underline"
          >
            dialect specifications
          </a>
          . See also{" "}
          <Link href="/docs/getting-started" className="text-accent underline">
            getting started
          </Link>
          .
        </p>
      </section>

      <section aria-labelledby="extended-h" className="space-y-4">
        <h2 id="extended-h" className="text-2xl font-bold">
          The extended machine
        </h2>
        <p className="max-w-2xl">
          Choose <strong>Machine: Extended</strong> in the simulator for a stack, subroutines,
          indirect and indexed addressing, interrupts and devices. Every classic program runs on it
          unchanged. The new instructions start with 4; one that needs an address (a) or a port (p)
          keeps it in the next mailbox, so it takes two mailboxes. The stack grows down from mailbox
          99.
        </p>
        <div
          className="overflow-x-auto"
          role="region"
          aria-label="Extended instructions, scrollable"
          tabIndex={0}
        >
          <table className="w-full min-w-[36rem] border-collapse text-sm">
            <caption className="mb-2 text-start text-lg font-bold">Extended instructions</caption>
            <thead>
              <tr className="text-start">
                <th scope="col" className="border-b-2 border-border-strong p-2">
                  Code
                </th>
                <th scope="col" className="border-b-2 border-border-strong p-2">
                  Written
                </th>
                <th scope="col" className="border-b-2 border-border-strong p-2">
                  What it does
                </th>
              </tr>
            </thead>
            <tbody>
              {EXTENDED.map(({ m, mode, written, does }) => (
                <tr key={written}>
                  <td className="border-b border-border p-2 font-mono">
                    {encodeExt(m, mode)}
                    {written.includes(" ") ? " + a" : ""}
                  </td>
                  <th scope="row" className="border-b border-border p-2 text-start font-mono">
                    {written}
                  </th>
                  <td className="border-b border-border p-2">{does}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div
          className="overflow-x-auto"
          role="region"
          aria-label="Device ports, scrollable"
          tabIndex={0}
        >
          <table className="w-full min-w-[36rem] border-collapse text-sm">
            <caption className="mb-2 text-start text-lg font-bold">Device ports</caption>
            <thead>
              <tr className="text-start">
                <th scope="col" className="border-b-2 border-border-strong p-2">
                  Port
                </th>
                <th scope="col" className="border-b-2 border-border-strong p-2">
                  Device
                </th>
                <th scope="col" className="border-b-2 border-border-strong p-2">
                  Use with
                </th>
                <th scope="col" className="border-b-2 border-border-strong p-2">
                  Meaning
                </th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(PORTS).map(([port, p]) => (
                <tr key={port}>
                  <th scope="row" className="border-b border-border p-2 text-start font-mono">
                    {port.padStart(2, "0")}
                  </th>
                  <td className="border-b border-border p-2">{p.device}</td>
                  <td className="border-b border-border p-2 font-mono">
                    {[p.read && "GET", p.write && "PUT"].filter(Boolean).join(", ")}
                  </td>
                  <td className="border-b border-border p-2">{PORT_DETAILS[Number(port)]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-sm text-muted">
          The full design is in the{" "}
          <a
            href="https://github.com/Joeboy77/Joes-SIM/blob/main/docs/specs/extended.md"
            className="text-accent underline"
          >
            extended machine specification
          </a>
          .
        </p>
      </section>

      <section aria-labelledby="multicore-h" className="space-y-3">
        <h2 id="multicore-h" className="text-2xl font-bold">
          The multicore machine
        </h2>
        <p className="max-w-2xl">
          Choose <strong>Machine: Multicore</strong> for two to four cores sharing the mailboxes.
          Each core runs the classic instructions; core 1, 2 and 3 start at the labels{" "}
          <code className="rounded-sm bg-surface-2 px-1 font-mono">core1</code> to{" "}
          <code className="rounded-sm bg-surface-2 px-1 font-mono">core3</code>, and core 0 at 00.
          One instruction of one core runs per step, in the order the schedule chooses.
        </p>
        <p className="max-w-2xl">
          <code className="rounded-sm bg-surface-2 px-1 font-mono">TAS a</code> (code 460 + a, two
          mailboxes) <strong>tests and sets</strong> a lock in one step: the accumulator gets the
          mailbox&apos;s old value and the mailbox becomes 1. A result of 0 means the lock was free
          and is now yours; write 0 back to release it. See the{" "}
          <a
            href="https://github.com/Joeboy77/Joes-SIM/blob/main/docs/specs/multicore.md"
            className="text-accent underline"
          >
            multicore specification
          </a>
          .
        </p>
      </section>
    </div>
  );
}
