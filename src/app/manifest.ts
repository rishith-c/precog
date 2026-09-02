import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Precog", short_name: "Precog",
    description: "See the click before you ship the page.",
    start_url: "/", display: "standalone",
    background_color: "#fbfbfd", theme_color: "#1d1d1f",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
