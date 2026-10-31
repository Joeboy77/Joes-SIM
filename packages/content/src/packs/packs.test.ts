import { assemble } from "@joes-sim/engine";
import { describe, expect, it } from "vitest";
import { CHALLENGES } from "../challenges/library";
import { DCIT_207 } from "./dcit207";
import { parsePack } from "./parse";

describe("teacher packs", () => {
  it("the DCIT 207 pack is valid and every challenge and program in it exists or assembles", () => {
    const r = parsePack(JSON.stringify(DCIT_207));
    expect(r.ok).toBe(true);
    for (const item of DCIT_207.items) {
      if (item.type === "challenge") expect(CHALLENGES.map((c) => c.id)).toContain(item.id);
      if (item.type === "program")
        expect(assemble(item.source, { dialect: DCIT_207.dialect }).ok).toBe(true);
    }
  });

  it("round-trips through JSON", () => {
    const r = parsePack(JSON.parse(JSON.stringify(DCIT_207)));
    expect(r.ok && r.pack).toEqual(DCIT_207);
  });

  it("refuses damaged packs with a reason", () => {
    const base = { format: "joes-sim-pack", version: 1, title: "T", dialect: "classic", items: [] };
    const err = (v: unknown) => {
      const r = parsePack(v);
      return r.ok ? "ok" : r.error;
    };
    expect(err("{")).toMatch(/not valid JSON/);
    expect(err({ format: "x" })).toMatch(/not a Joe's SIM teacher pack/);
    expect(err({ ...base, version: 2 })).toMatch(/newer version/);
    expect(err({ ...base, title: " " })).toMatch(/no title/);
    expect(err({ ...base, dialect: "x86" })).toMatch(/dialect/);
    expect(err({ ...base, items: {} })).toMatch(/no list of items/);
    for (const item of [
      3,
      { type: "heading" },
      { type: "lesson" },
      { type: "challenge" },
      { type: "program", title: "p" },
      { type: "video" },
    ]) {
      expect(err({ ...base, items: [item] })).toMatch(/Item 1 in the pack is damaged/);
    }
    expect(err(base)).toBe("ok");
  });

  it("fills in a missing id and keeps notes and inputs", () => {
    const r = parsePack({
      format: "joes-sim-pack",
      version: 1,
      title: "Mine",
      dialect: "ocr",
      items: [
        { type: "program", title: "P", source: "HLT", inputs: "1", note: "Try it" },
        { type: "heading", title: "H", note: 4 },
      ],
    });
    expect(r.ok && r.pack.id).toMatch(/^pack-/);
    expect(r.ok && r.pack.items).toEqual([
      { type: "program", title: "P", source: "HLT", inputs: "1", note: "Try it" },
      { type: "heading", title: "H" },
    ]);
    expect(r.ok && r.pack.author).toBe("");
  });
});
