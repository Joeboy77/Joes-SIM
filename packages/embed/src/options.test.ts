import { describe, expect, it } from "vitest";
import { DEFAULT_PANELS, parseEmbedOptions } from "./options";

const parse = (q: string) => parseEmbedOptions(new URLSearchParams(q));

describe("embed options", () => {
  it("has sensible defaults", () => {
    expect(parse("")).toEqual({
      program: null,
      p: null,
      name: "",
      dialect: null,
      view: null,
      inputs: null,
      readonly: false,
      panels: DEFAULT_PANELS,
    });
  });

  it("reads every option", () => {
    const s = parse(
      `program=${encodeURIComponent("        INP\n        OUT\n        HLT")}&name=Echo&dialect=OCR&view=story&inputs=3&readonly&panels=machine,io`,
    );
    expect(s).toMatchObject({
      program: "        INP\n        OUT\n        HLT",
      name: "Echo",
      dialect: "ocr",
      view: "story",
      inputs: "3",
      readonly: true,
      panels: ["machine", "io"],
    });
  });

  it("ignores values it does not know", () => {
    const s = parse("dialect=risc&view=3d&panels=nonsense&readonly=false");
    expect(s.dialect).toBeNull();
    expect(s.view).toBeNull();
    expect(s.panels).toEqual(DEFAULT_PANELS);
    expect(s.readonly).toBe(false);
    expect(parse("readonly=1").readonly).toBe(true);
    expect(parse("panels=memory editor").panels).toEqual(["editor", "memory"]);
  });
});
