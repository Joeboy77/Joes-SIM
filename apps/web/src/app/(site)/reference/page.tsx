import { DIALECTS, DIALECT_IDS, encode, type Mnemonic } from "@joes-sim/engine";
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

      <table className="w-full border-collapse text-sm">
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
    </div>
  );
}
