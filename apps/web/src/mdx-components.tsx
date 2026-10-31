import type { MDXComponents } from "mdx/types";
import { LessonSim } from "@/lessons/LessonSim";
import { Highlight, Note, Predict } from "@/lessons/parts";

/** Components every lesson can use, and plain elements styled for reading. */
const components: MDXComponents = {
  LessonSim,
  Predict,
  Highlight,
  Note,
  h1: (p) => <h1 className="mb-4 text-3xl font-bold" {...p} />,
  a: (p) => <a className="text-accent underline underline-offset-2" {...p} />,
  h2: (p) => <h2 className="mt-8 mb-2 text-2xl font-bold" {...p} />,
  h3: (p) => <h3 className="mt-6 mb-2 text-xl font-bold" {...p} />,
  p: (p) => <p className="my-3 max-w-prose leading-relaxed" {...p} />,
  ul: (p) => <ul className="my-3 max-w-prose list-disc space-y-1 pl-6" {...p} />,
  ol: (p) => <ol className="my-3 max-w-prose list-decimal space-y-1 pl-6" {...p} />,
  code: (p) => <code className="rounded-sm bg-surface-2 px-1 font-mono text-[0.95em]" {...p} />,
  // Long code examples scroll sideways; keyboard users must be able to reach them.
  pre: (p) => (
    <pre
      tabIndex={0}
      className="my-3 overflow-auto rounded-md border border-border bg-surface-2 p-3 font-mono text-sm"
      {...p}
    />
  ),
  strong: (p) => <strong className="font-bold" {...p} />,
  table: (p) => <table className="my-3 border-collapse text-sm" {...p} />,
  th: (p) => <th className="border border-border px-2 py-1 text-left" {...p} />,
  td: (p) => <td className="border border-border px-2 py-1" {...p} />,
};

export function useMDXComponents(): MDXComponents {
  return components;
}
