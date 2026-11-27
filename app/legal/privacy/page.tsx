import type { Metadata } from "next";
import Link from "next/link";

import { SiteHeader } from "@/components/layout/site-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Privacy",
  description: "What icone stores, why it stores it and the choices you have.",
};

const sections = [
  {
    title: "What we store",
    body: "Your name, phone and sign-in identifier (email or Telegram id), plus bookings, reviews, saved barbers, notifications and preferences.",
  },
  {
    title: "Why we store it",
    body: "To reserve chairs, show visits, send reminders and help support. We never use your details for advertising.",
  },
  {
    title: "Where it lives",
    body: "Data sits in Appwrite (fra region). Your session secret is in an HttpOnly cookie, never in localStorage, and the server API key never reaches the browser.",
  },
  {
    title: "Who can see it",
    body: "A barber sees your name, service, time and note for a visit. Admin staff manage the catalogue and moderate reviews. We do not sell or rent your data.",
  },
  {
    title: "Your choices",
    body: "Settings lets you change your details and preferences. Ask support to export or delete your data; we comply unless the law requires a record.",
  },
  {
    title: "Retention",
    body: "Booking and review records stay for your history. Closing your account removes personal details, except what the law requires.",
  },
  {
    title: "Security",
    body: "All privileged access runs server-side. There are no passwords — sign-in uses a short-lived code or a signed Telegram payload.",
  },
  {
    title: "Changes",
    body: "We update this page if the policy changes materially. The date below refers to the current version.",
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
              Email hello@icone.uz or use the Telegram bot.
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

    </div>
  );
}
