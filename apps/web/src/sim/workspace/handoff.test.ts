import { describe, expect, it } from "vitest";
import { handoffHref, readHandoff } from "./handoff";

describe("opening a program in the simulator", () => {
  it("round-trips through the URL fragment, including any text", () => {
    const h = {
      name: "Échos ✓",
      source: "        INP\n        OUT\n",
      dialect: "ocr" as const,
      inputs: "3, 4",
      cycle: 5,
    };
    const href = handoffHref(h);
    expect(href).toMatch(/^\/sim#open=[A-Za-z0-9_-]+$/);
    expect(readHandoff(href.slice(4))).toEqual(h);
  });

  it("ignores anything else", () => {
    expect(readHandoff("")).toBeNull();
    expect(readHandoff("#open=!!!")).toBeNull();
    expect(
      readHandoff(`#open=${btoa(JSON.stringify({ source: "HLT", dialect: "x" }))}`),
    ).toBeNull();
    expect(
      readHandoff(
        `#open=${btoa(JSON.stringify({ source: "HLT", dialect: "classic", cycle: -2 }))}`,
      ),
    ).toEqual({
      name: "Opened program",
      source: "HLT",
      dialect: "classic",
      inputs: "",
      cycle: 0,
    });
  });
});
