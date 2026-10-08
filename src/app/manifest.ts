import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "LandOS — Land intelligence workspace",
    short_name: "LandOS",
    description:
      "Map, analyse and manage Australian land in one private spatial workspace.",
    start_url: "/app/map",
    display: "standalone",
    background_color: "#f4f3e9",
    theme_color: "#0a0f1d",
    icons: [
      {
        src: "/brand/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/brand/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/brand/icon-512-maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
