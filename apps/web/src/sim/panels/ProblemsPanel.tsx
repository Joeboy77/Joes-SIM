"use client";

import { useSimState } from "../SimProvider";

export function ProblemsPanel() {
  const diagnostics = useSimState((s) => s.assembled.diagnostics);
  const findings = useSimState((s) => s.findings);
  const total = diagnostics.length + findings.length;

  return (
    <section aria-labelledby="problems-h">
      <h2 id="problems-h" className="mb-1 text-sm font-bold">
        Problems {total ? `(${total})` : ""}
      </h2>
      {total === 0 ? (
        <p className="text-sm text-muted">✓ No problems found.</p>
      ) : (
        <ul className="space-y-2 text-sm">
          {diagnostics.map((d, i) => (
            <li key={`d${i}`} className="rounded-sm border border-border p-2">
              <p className={d.severity === "error" ? "font-bold text-danger" : "font-bold"}>
                {d.severity === "error" ? "✖ Error" : "⚠ Warning"} on line {d.line}: {d.message}
              </p>
              <p className="text-muted">{d.explanation}</p>
            </li>
          ))}
          {findings.map((f, i) => (
            <li key={`f${i}`} className="rounded-sm border border-border p-2">
              <p className="font-bold">
                {f.severity === "warning" ? "⚠ Check" : "ℹ Note"}
                {f.line ? ` line ${f.line}` : ""}: {f.message}
              </p>
              <p className="text-muted">{f.explanation}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
