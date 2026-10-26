import type { MetadataRoute } from "next";

// Installable on phones (design §6). Docs: https://nextjs.org/docs/app/api-reference/file-conventions/metadata/manifest
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "MUSD Compass",
    short_name: "MUSD Compass",
    description: "Where Mezo MUSD earns the most after costs — cash first, locked veMEZO beside it.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
