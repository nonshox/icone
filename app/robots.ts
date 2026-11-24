import type { MetadataRoute } from "next";

const site = process.env.NEXT_PUBLIC_APP_URL ?? "https://icone-uz.vercel.app";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/account", "/book", "/bookings", "/agenda", "/api/"],
    },
    sitemap: `${site}/sitemap.xml`,
    host: site,
  };
}
