import { readFileSync } from "node:fs";
import { join } from "node:path";

export const dynamic = "force-static";

// Read once, at build time, from the embed package (the app is built inside the monorepo).
const SOURCE = readFileSync(join(process.cwd(), "../../packages/embed/src/joes-sim.js"), "utf8");

/** The <joes-sim> web component, as one script: <script src="https://…/joes-sim.js"></script>. */
export function GET() {
  return new Response(SOURCE, {
    headers: {
      "content-type": "text/javascript; charset=utf-8",
      "cache-control": "public, max-age=3600",
      "access-control-allow-origin": "*",
    },
  });
}
