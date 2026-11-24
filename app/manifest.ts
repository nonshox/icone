import type { MetadataRoute } from "next";

const site = process.env.NEXT_PUBLIC_APP_URL ?? "https://icone-uz.vercel.app";

/** Generated at /manifest.webmanifest by Next.js. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "icone — your chair is waiting",
    short_name: "icone",
    description:
      "Book Tashkent's sharpest barbers in seconds. No calls, no queues, no passwords.",
    id: `${site}/`,
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#f7f5f0",
    theme_color: "#0f0f10",
    icons: [
      {
        src: "/logotype/android-chrome-192x192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/logotype/android-chrome-512x512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
