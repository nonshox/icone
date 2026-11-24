import type { Metadata } from "next";
import Link from "next/link";

import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Privacy",
  description: "What icone stores, why it stores it and the choices you have.",
};

const sections = [
  {
    title: "What we store",
    body: "Your display name, phone number and sign-in identifier (an email address or a Telegram id). We also keep the bookings you make, reviews you post, barbers you save, notifications in your inbox and your notification choices.",
  },
  {
    title: "Why we store it",
    body: "To reserve a chair, show your visits, send the reminders you asked for and help support resolve a problem. We do not use your details for advertising.",
  },
  {
    title: "Where it lives",
    body: "Data is kept in Appwrite in the fra region. Your session secret lives in an HttpOnly cookie on your device. We do not put session tokens in localStorage and we never send the server API key to the browser.",
  },
  {
    title: "Who can see it",
    body: "A barber sees the details needed for a visit: your name, the service, the time and any note you left. Admin staff can manage the catalogue and moderate reviews. We do not sell or rent your information.",
  },
  {
    title: "Your choices",
    body: "Settings lets you change your name, phone, avatar and notification choices at any time. You can ask us to export or delete your account data through support, and we will comply unless we must keep a record for legal reasons.",
  },
  {
    title: "Retention",
    body: "Booking and review records stay so you can look back at your visits. If you close your account, we remove personal details and keep only what the law requires.",
  },
  {
    title: "Security",
    body: "Every privileged read and write goes through server-side code. Passwords do not exist here: sign-in uses a short-lived code or a signed Telegram payload. Access is limited to what each role needs.",
  },
  {
    title: "Changes",
    body: "If this policy changes in a meaningful way, we will update this page. The date below always refers to the current version.",
  },
];

export default function PrivacyPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />

      <main id="main" className="mx-auto w-full max-w-3xl flex-1 px-6 pt-10 pb-10">
        <div className="space-y-2">
          <p className="text-xs font-medium tracking-[0.18em] text-brand-strong uppercase">
            Legal
          </p>
          <h1 className="text-3xl font-semibold tracking-[-0.04em]">Privacy</h1>
          <p className="text-sm text-muted-foreground">
            Updated 1 January 2026 · icone, Tashkent
          </p>
        </div>

        <p className="mt-6 text-sm leading-relaxed text-muted-foreground">
          This page explains what icone keeps when you book a chair and why. It
          is written to be read, not to be skipped.
        </p>

        <div className="mt-8 space-y-4">
          {sections.map((section) => (
            <Card key={section.title} size="sm">
              <CardHeader>
                <CardTitle>{section.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {section.body}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Questions about your data</CardTitle>
            <CardDescription>
              Write to hello@icone.uz or reach the bot in Telegram. We answer
              privacy requests directly.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
            <Link href="/support" className="font-medium text-brand-strong hover:underline">
              Contact support →
            </Link>
            <Link href="/legal/terms" className="font-medium text-brand-strong hover:underline">
              Terms of use →
            </Link>
          </CardContent>
        </Card>
      </main>

      <SiteFooter />
    </div>
  );
}
