import type { Metadata } from "next";
import { Gallery } from "@/community/Gallery";

export const metadata: Metadata = {
  title: "Gallery",
  description:
    "Programs that learners chose to share with everyone. Open any of them in the simulator, step through it and change it.",
};

export default function GalleryPage() {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">Gallery</h1>
        <p className="max-w-2xl">
          Programs that learners chose to share with everyone. Open one in the simulator to run it,
          step through it and change it; your changes stay on your device. To add your own, press{" "}
          <strong>Share</strong> in the simulator.
        </p>
      </div>
      <Gallery />
    </div>
  );
}
