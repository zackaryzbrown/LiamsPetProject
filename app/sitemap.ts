import type { MetadataRoute } from "next";
import { env } from "@/lib/env";

const PUBLIC_ROUTES = [
  "",
  "/about",
  "/contact",
  "/enter",
  "/login",
  "/rules",
  "/submitted",
  "/vote",
] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  const site = new URL(env.NEXT_PUBLIC_SITE_URL);
  const now = new Date();

  return PUBLIC_ROUTES.map((path) => ({
    url: new URL(path || "/", site).toString(),
    lastModified: now,
  }));
}
