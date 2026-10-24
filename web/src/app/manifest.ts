import type { MetadataRoute } from "next";

// Installable on phones (design §6). Docs: https://nextjs.org/docs/app/api-reference/file-conventions/metadata/manifest
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "MUSD Compass",
    short_name: "Compass",
    description: "Where Mezo MUSD earns the most after costs — cash first, locked veMEZO beside it.",
    start_url: "/",
    display: "standalone",
    background_color: "#e6e9ed",
    theme_color: "#ffd200",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
