import Link from "next/link";

export default function HomePage() {
  return (
    <div className="space-y-6">
      <h1 className="text-4xl leading-tight font-bold">
        See what a computer is doing, step by step.
      </h1>
      <p className="max-w-2xl text-lg text-muted">
        Joe&apos;s SIM is a free Little Man Computer simulator for learning how computers work at
        the machine level. Write a program, run it, and watch every fetch, decode and execute.
      </p>
      <Link
        href="/sim"
        className="inline-block rounded-md bg-accent px-5 py-3 font-bold text-on-accent"
      >
        Open the simulator
      </Link>
    </div>
  );
}
