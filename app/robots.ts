import type { MetadataRoute } from "next";

const site = process.env.NEXT_PUBLIC_APP_URL ?? "https://icone-uz.vercel.app";

/** Session-bound screens and endpoints must never be indexed. */
const privatePaths = [
  "/account",
  "/admin",
  "/agenda",
  "/barber",
  "/book",
  "/bookings",
  "/account",
  "/favorites",
  "/invites",
  "/messages",
  "/notifications",
  "/settings",
  "/sign-in",
  "/start",
  "/waits",
  "/api/",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: privatePaths,
    },
    sitemap: `${site}/sitemap.xml`,
    host: site,
  };
}
