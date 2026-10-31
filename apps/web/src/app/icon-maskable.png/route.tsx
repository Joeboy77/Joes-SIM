import { drawIcon } from "@/lib/icon/draw";

export const dynamic = "force-static";

/** Maskable: the picture stays inside the safe zone, so any mask shape keeps it whole. */
export function GET() {
  return drawIcon(512, 80);
}
