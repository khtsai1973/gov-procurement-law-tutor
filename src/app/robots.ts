import type { MetadataRoute } from "next";

import { getAppUrlFromEnv } from "@/lib/app-url";
import { ROBOTS_DISALLOW_PATHS } from "@/lib/seo-routes";

export default function robots(): MetadataRoute.Robots {
  const base = getAppUrlFromEnv();
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [...ROBOTS_DISALLOW_PATHS],
    },
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
