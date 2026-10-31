import { drawIcon } from "@/lib/icon/draw";

export const size = { width: 64, height: 64 };
export const contentType = "image/png";

export default function Icon() {
  return drawIcon(64);
}
