import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: { absolute: "Joe's SIM: see what a computer is doing, step by step" },
  description:
    "A free Little Man Computer simulator with lessons, challenges and teacher packs. Watch every fetch, decode and execute. No account, works offline.",
};

const FEATURES = [
  {
    href: "/sim",
    title: "The simulator",
    text: "Write a program and watch values move between the registers, step by step, forwards and backwards, with every step explained.",
  },
  {
    href: "/learn",
    title: "Lessons",
    text: "Ten short lessons from 'What is a computer?' to arrays, each with live simulators and questions.",
  },
  {
    href: "/challenges",
    title: "Challenges",
    text: "47 puzzles with tests, hints and scores to beat, including bug hunts.",
  },
] as const;

export default function HomePage() {
  return (
    <div className="space-y-12">
      <section className="space-y-6">
        <h1 className="text-4xl leading-tight font-bold">
          See what a computer is doing, step by step.
        </h1>
        <p className="max-w-2xl text-lg text-muted">
          Joe&apos;s SIM is a free Little Man Computer simulator for learning how computers work at
          the machine level. Write a program, run it, and watch every fetch, decode and execute.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/sim"
            className="inline-block rounded-md bg-accent px-5 py-3 font-bold text-on-accent"
          >
            Open the simulator
          </Link>
          <Link
            href="/learn/what-is-a-computer"
            className="inline-block rounded-md border border-border-strong px-5 py-3 font-bold"
          >
            Start the first lesson
          </Link>
        </div>
      </section>

      <section aria-labelledby="what-h" className="space-y-4">
        <h2 id="what-h" className="text-2xl font-bold">
          What you can do
        </h2>
        <ul className="grid gap-4 md:grid-cols-3">
          {FEATURES.map((f) => (
            <li key={f.href} className="rounded-md border border-border bg-surface p-4">
              <Link
                href={f.href}
                className="text-lg font-bold text-accent underline-offset-4 hover:underline"
              >
                {f.title}
              </Link>
              <p className="mt-1">{f.text}</p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="teach-h" className="space-y-2">
        <h2 id="teach-h" className="text-2xl font-bold">
          For teachers
        </h2>
        <p className="max-w-2xl">
          Put lessons and challenges in order with{" "}
          <Link href="/packs" className="text-accent underline">
            teacher packs
          </Link>
          , share programs as links, and{" "}
          <Link href="/docs/embed" className="text-accent underline">
            embed a live simulator
          </Link>{" "}
          in Moodle, Sakai, Canvas or your slides. The DCIT 207 pack follows the course from the von
          Neumann model to performance.
        </p>
      </section>

      <section aria-labelledby="promise-h" className="space-y-2">
        <h2 id="promise-h" className="text-2xl font-bold">
          Free, private and works anywhere
        </h2>
        <ul className="max-w-2xl list-disc space-y-1 pl-6">
          <li>No account. Open it and start; your work saves itself on your device.</li>
          <li>Works offline after your first visit, and installs as an app.</li>
          <li>
            Built for phones, keyboards and screen readers, in light, dark and high-contrast themes.
          </li>
          <li>Open source: MIT for the code, CC BY 4.0 for the lessons and challenges.</li>
        </ul>
      </section>
    </div>
  );
}
