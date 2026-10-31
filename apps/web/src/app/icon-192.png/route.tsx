import { drawIcon } from "@/lib/icon/draw";

export const dynamic = "force-static";

export function GET() {
  return drawIcon(192);
}
