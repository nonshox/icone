import type { MetadataRoute } from "next";

const site = process.env.NEXT_PUBLIC_APP_URL ?? "https://icone-uz.vercel.app";
// Fixed date so the sitemap is deterministic at build time.
const updated = "2026-11-24";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: site,
      lastModified: updated,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${site}/sign-in`,
      lastModified: updated,
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${site}/barbers`,
      lastModified: updated,
      changeFrequency: "weekly",
      priority: 0.7,
    },
  ];
}
