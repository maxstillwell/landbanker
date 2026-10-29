import type { MetadataRoute } from "next";
import { isPreview, siteOrigin } from "@/components/marketing/seo";

export default function robots(): MetadataRoute.Robots {
  if (isPreview) return { rules: { userAgent: "*", disallow: "/" } };
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/app",
        "/api/",
        "/auth/",
        "/share/",
        "/login",
        "/signup",
        "/forgot-password",
      ],
    },
    sitemap: `${siteOrigin}/sitemap.xml`,
  };
}
