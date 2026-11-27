import type { MetadataRoute } from "next";

const site = process.env.NEXT_PUBLIC_APP_URL ?? "https://icone-uz.vercel.app";
// Fixed date so the sitemap is deterministic at build time.
const updated = "2026-11-27";

type Frequency = NonNullable<MetadataRoute.Sitemap[number]["changeFrequency"]>;

function route(path: string, changeFrequency: Frequency, priority: number) {
  return {
    url: `${site}${path}`,
    lastModified: updated,
    changeFrequency,
    priority,
  };
}

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    // Public discovery and information pages.
    route("/", "weekly", 1),
    route("/barbers", "weekly", 0.9),
    route("/map", "weekly", 0.8),
    route("/services", "monthly", 0.7),
    route("/become-barber", "monthly", 0.7),
    route("/help", "monthly", 0.6),
    route("/support", "monthly", 0.5),
    route("/sign-in", "monthly", 0.4),
    route("/legal/terms", "yearly", 0.3),
    route("/legal/privacy", "yearly", 0.3),

    // Signed-in surfaces. Listed for completeness; robots keeps them out of
    // the index because they depend on a session cookie.
    route("/book", "weekly", 0.6),
    route("/bookings", "weekly", 0.4),
    route("/account", "monthly", 0.4),
    route("/agenda", "weekly", 0.3),
    route("/favorites", "monthly", 0.3),
    route("/messages", "weekly", 0.3),
    route("/notifications", "weekly", 0.3),
    route("/waits", "monthly", 0.3),
    route("/invites", "monthly", 0.3),
    route("/customer", "monthly", 0.3),
    route("/barber", "monthly", 0.3),
    route("/admin", "monthly", 0.2),
    route("/start", "monthly", 0.1),
  ];
}
