import { describe, expect, it } from "vitest";
import { STARTER_PROGRAM } from "../store";
import { LONG_LINK, decodeShare, encodeShare, sharePath } from "./share";

const program = {
  name: "Add two numbers",
  source: STARTER_PROGRAM,
  dialect: "higginson" as const,
  machine: "classic" as const,
  inputs: "3, 4",
  view: "story" as const,
};

describe("share links", () => {
  it("round-trip the program, inputs, dialect, view and name exactly", () => {
    expect(decodeShare(encodeShare(program))).toEqual(program);
  });

  it("are safe in a URL and short for a typical program", () => {
    const p = encodeShare(program);
    expect(p).toMatch(/^[A-Za-z0-9+\-$_]+$/);
    expect(sharePath(program).length).toBeLessThan(LONG_LINK);
    expect(sharePath(program, "/embed")).toMatch(/^\/embed\?p=/);
  });

  it("leave out defaults", () => {
    const plain = { ...program, name: "", inputs: "", view: "datapath" as const };
    expect(decodeShare(encodeShare(plain))).toEqual(plain);
  });

  it("carry the extended machine", () => {
    const ext = { ...program, machine: "extended" as const };
    expect(decodeShare(encodeShare(ext))).toEqual(ext);
  });

  it("ignore damaged or foreign links", () => {
    expect(decodeShare(null)).toBeNull();
    expect(decodeShare("")).toBeNull();
    expect(decodeShare("!!not-lz")).toBeNull();
    const wrong = encodeShare(program).slice(0, 10);
    expect(decodeShare(wrong)).toBeNull();
  });
});
