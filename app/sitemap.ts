import type { MetadataRoute } from "next";
import { projects } from "@/lib/portfolio";
import { siteUrl } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const routes = ["/", ...projects.map((project) => `/work/${project.slug}`)];

  return routes.map((route) => ({
    url: new URL(route, siteUrl).toString(),
    changeFrequency: route === "/" ? "monthly" : "yearly",
    priority: route === "/" ? 1 : 0.8,
  }));
}
