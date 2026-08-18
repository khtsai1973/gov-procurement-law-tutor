import type { MetadataRoute } from "next";

import { getAppUrlFromEnv } from "@/lib/app-url";
import { PUBLIC_SITEMAP_PATHS, absoluteUrl } from "@/lib/seo-routes";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = getAppUrlFromEnv();
  return PUBLIC_SITEMAP_PATHS.map((path) => ({
    url: absoluteUrl(base, path),
    changeFrequency: path === "/" ? "weekly" : "weekly",
    priority: path === "/" ? 1 : 0.7,
  }));
}
