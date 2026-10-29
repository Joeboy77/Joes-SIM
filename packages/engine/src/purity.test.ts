import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Guards the rule from the brief (Section 4.2): the engine has no UI or browser dependencies.
const FORBIDDEN_IMPORTS = /from\s+["'](react|react-dom|next|@joes-sim\/ui)(\/|["'])/;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return name.endsWith(".ts") && !name.endsWith(".test.ts") ? [path] : [];
  });
}

describe("engine purity", () => {
  it("does not import UI or framework code", () => {
    const offenders = sourceFiles(join(import.meta.dirname)).filter((file) =>
      FORBIDDEN_IMPORTS.test(readFileSync(file, "utf8")),
    );
    expect(offenders).toEqual([]);
  });
});
