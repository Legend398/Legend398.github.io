import type { MetadataRoute } from "next";

export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Himanshu Kumar — Software Engineer · Agentic AI Engineer · Data Science",
    short_name: "HK Portfolio",
    description: "A portfolio spanning software engineering, agentic AI engineering, and data science.",
    start_url: "/",
    display: "standalone",
    background_color: "#f1ece2",
    theme_color: "#f1ece2",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
