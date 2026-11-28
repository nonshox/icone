import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import { Analytics } from "@vercel/analytics/react";

import { T } from "@/components/i18n/t";
import { Providers } from "@/components/providers";
import { MobileNav } from "@/components/layout/mobile-nav";
import { metaText } from "@/lib/metadata";

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

// Static metadata cannot read the browser's locale: Uzbek is the default.
const siteTitle = metaText("meta.site.title");
const description = metaText("meta.site.description");

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: {
    default: siteTitle,
    template: "%s · icone",
  },
  description,
  applicationName: "icone",
  creator: "icone",
  publisher: "icone",
  category: "Booking",
  keywords: [
    "icone",
    "barber",
    "barbershop",
    "Tashkent",
    "Toshkent",
    "booking",
    "haircut",
    "beard trim",
    "sartarosh",
  ],
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    siteName: "icone",
    locale: metaText("meta.site.ogLocale"),
    title: siteTitle,
    description,
    url: appUrl,
  },
  twitter: {
    card: "summary_large_image",
    title: siteTitle,
    description,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-snippet": -1,
      "max-image-preview": "large",
    },
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
      lang="uz"
      data-scroll-behavior="smooth"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${instrumentSerif.variable} h-full`}
    >
      <body className="flex min-h-full flex-col pb-16 md:pb-0">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground"
        >
          <T k="nav.skip" />
        </a>
        <Providers>
          {children}
          {/* Role-aware tabs read useMe(), so they must sit inside Providers. */}
          <MobileNav />
        </Providers>
        <Analytics />
      </body>
    </html>
  );
}
