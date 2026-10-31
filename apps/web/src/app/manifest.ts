import type { MetadataRoute } from "next";

/** Lets Joe's SIM be installed as an app. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Joe's SIM",
    short_name: "Joe's SIM",
    description:
      "Learn how computers work with the Little Man Computer, step by step. Works offline.",
    start_url: "/sim",
    scope: "/",
    display: "standalone",
    background_color: "#f6f7f9",
    theme_color: "#1d4ed8",
    categories: ["education"],
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
