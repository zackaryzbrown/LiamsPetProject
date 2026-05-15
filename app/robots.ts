import type { MetadataRoute } from "next";
import { env } from "@/lib/env";

export default function robots(): MetadataRoute.Robots {
  const site = new URL(env.NEXT_PUBLIC_SITE_URL);
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/account"],
    },
    sitemap: `${site.origin}/sitemap.xml`,
    host: site.origin,
  };
}
