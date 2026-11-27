import type { Metadata } from "next";
import Link from "next/link";

import { SiteHeader } from "@/components/layout/site-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Terms",
  description: "The terms that apply when you book a chair through icone.",
};

const sections = [
  {
    title: "Using icone",
    body: "icone connects members with barbers in Tashkent. We run the booking service; the barber provides the cut. Booking means you agree to arrive on time.",
  },
  {
    title: "Accounts",
    body: "Sign in with Telegram. Give accurate details and keep access to your Telegram account. One person per account.",
  },
  {
    title: "Bookings",
    body: "A slot is held once it appears under My visits. Same-day bookings need 30 minutes of lead time; the calendar opens 60 days ahead. The earlier request wins a contested slot.",
  },
  {
    title: "Changes and cancellations",
    body: "Cancel a future booking from My visits as early as you can. Repeated no-shows may limit your ability to book.",
  },
  {
    title: "Prices and payment",
    body: "Prices are in UZS before you confirm. Payment is settled with the barber at the shop unless an offer states otherwise.",
  },
  {
    title: "Reviews",
    body: "One review per completed booking. Reviews must describe your own visit; we may hide abusive or unrelated ones.",
  },
  {
    title: "Promotions",
    body: "Barbers publish offers with their own dates and usage limits. The conditions on the barber profile apply.",
  },
  {
    title: "Availability of the service",
    body: "Hours, schedules and barbers can change. If a visit cannot go ahead, we will tell you and help find another time.",
  },
  {
    title: "Responsibility",
    body: "The barber is responsible for the cut; icone for the booking platform. Neither is liable for losses not reasonably expected from a haircut appointment.",
  },
  {
    title: "Changes to these terms",
    body: "We may update these terms. The current version is always on this page with the date below.",
  },
];

export default function TermsPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />

      <main id="main" className="mx-auto w-full max-w-3xl flex-1 px-6 pt-10 pb-10">
        <div className="space-y-2">
          <p className="text-xs font-medium tracking-[0.18em] text-brand-strong uppercase">
            Legal
          </p>
          <h1 className="text-3xl font-semibold tracking-[-0.04em]">Terms of use</h1>
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
            <CardTitle>Governing law</CardTitle>
            <CardDescription>
              These terms are governed by the law of the Republic of Uzbekistan.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
            <Link href="/legal/privacy" className="font-medium text-brand-strong hover:underline">
              Privacy policy →
            </Link>
            <Link href="/support" className="font-medium text-brand-strong hover:underline">
              Contact support →
            </Link>
          </CardContent>
        </Card>
      </main>

    </div>
  );
}
