import type { MetadataRoute } from "next";
import { isPreview, publicPaths, siteOrigin } from "@/components/marketing/seo";

export default function sitemap(): MetadataRoute.Sitemap {
  if (isPreview) return [];
  return publicPaths.map((path) => ({ url: new URL(path, siteOrigin).href }));
}
