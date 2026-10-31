import { DIALECTS } from "@joes-sim/engine";
import { ImageResponse } from "next/og";
import { decodeShare } from "@/sim/workspace/share";

/**
 * Draws the preview card for a share link: the program's name and its first lines. Stateless:
 * everything comes from the `p` parameter, so no database stores shared programs.
 */
export function GET(request: Request) {
  const shared = decodeShare(new URL(request.url).searchParams.get("p"));
  const title = shared?.name || (shared ? "A Little Man Computer program" : "Joe's SIM");
  const lines = (shared?.source ?? "        INP\n        OUT\n        HLT")
    .split("\n")
    .filter((l) => l.trim() !== "")
    .slice(0, 9)
    .map((l) => (l.length > 44 ? `${l.slice(0, 43)}…` : l));
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: "#f6f7f9",
        color: "#14161a",
        padding: 56,
        fontSize: 32,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: 34, fontWeight: 700, color: "#1d4ed8" }}>Joe&apos;s SIM</div>
        <div style={{ fontSize: 26, color: "#4b5563" }}>
          {shared ? `${DIALECTS[shared.dialect].name} dialect` : "Little Man Computer"}
        </div>
      </div>
      <div style={{ fontSize: 56, fontWeight: 700, marginTop: 24 }}>{title}</div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          marginTop: 28,
          padding: 24,
          background: "#ffffff",
          border: "3px solid #c9ced6",
          borderRadius: 16,
          fontFamily: "monospace",
          fontSize: 28,
          lineHeight: 1.35,
          flexGrow: 1,
        }}
      >
        {lines.map((l, i) => (
          <div key={i} style={{ whiteSpace: "pre", display: "flex" }}>
            {l}
          </div>
        ))}
      </div>
      <div style={{ marginTop: 20, fontSize: 24, color: "#4b5563" }}>
        Open the link to run it, step by step. No account needed.
      </div>
    </div>,
    { width: 1200, height: 630 },
  );
}
