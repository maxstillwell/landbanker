import type { Metadata } from "next";

// Canonicals describe the production site, never a transient preview hostname.
export const siteOrigin = new URL(
  process.env.LAND_BANKER_APP_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "https://landbanker.vercel.app",
).origin;
export const isPreview = Boolean(
  process.env.VERCEL_ENV && process.env.VERCEL_ENV !== "production",
);
export const publicPaths = [
  "/",
  "/features",
  "/layers",
  "/solutions",
  "/pricing",
  "/about",
  "/contact",
] as const;

export function pageMetadata(
  path: string,
  title: string,
  description: string,
): Metadata {
  const fullTitle = `${title} | LandOS`;
  return {
    title: fullTitle,
    description,
    metadataBase: new URL(siteOrigin),
    alternates: { canonical: path },
    robots: { index: !isPreview, follow: !isPreview },
    openGraph: {
      type: "website",
      siteName: "LandOS",
      locale: "en_AU",
      url: path,
      title: fullTitle,
      description,
      images: [
        {
          url: "/marketing/social-card.png",
          width: 1200,
          height: 630,
          alt: "LandOS — Your land. Your research. Your intelligence.",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description,
      images: ["/marketing/social-card.png"],
    },
  };
}
