import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import { Analytics } from "@vercel/analytics/react";

import { Providers } from "@/components/providers";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument-serif",
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  display: "swap",
});

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://icone-uz.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: {
    default: "icone — your chair is waiting",
    template: "%s · icone",
  },
  description:
    "Book Tashkent's sharpest barbers in seconds. No calls, no queues — one-time sign-in, clean cuts, on your time.",
  applicationName: "icone",
  keywords: [
    "icone",
    "barber",
    "barbershop",
    "Tashkent",
    "booking",
    "haircut",
    "beard trim",
  ],
  openGraph: {
    type: "website",
    siteName: "icone",
    title: "icone — your chair is waiting",
    description:
      "Book Tashkent's sharpest barbers in seconds. One-time sign-in. No passwords.",
    url: appUrl,
  },
  twitter: {
    card: "summary_large_image",
    title: "icone — your chair is waiting",
    description:
      "Book Tashkent's sharpest barbers in seconds. One-time sign-in. No passwords.",
  },
  icons: {
    icon: [
      {
        url: "/logotype/favicon-16x16.png",
        sizes: "16x16",
        type: "image/png",
      },
      {
        url: "/logotype/favicon-32x32.png",
        sizes: "32x32",
        type: "image/png",
      },
    ],
    apple: {
      url: "/logotype/apple-touch-icon.png",
      sizes: "180x180",
      type: "image/png",
    },
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f5f0" },
    { media: "(prefers-color-scheme: dark)", color: "#0f0f10" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${instrumentSerif.variable} h-full`}
    >
      <body className="flex min-h-full flex-col">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground"
        >
          Skip to content
        </a>
        <Providers>{children}</Providers>
        <Analytics />
      </body>
    </html>
  );
}
