import type { Metadata } from "next";
import Link from "next/link";

import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Terms",
  description: "The terms that apply when you book a chair through icone.",
};

const sections = [
  {
    title: "Using icone",
    body: "icone connects members with barbers in Tashkent. We provide the booking service; the barber provides the cut. By booking, you agree to these terms and to arrive on time for the chair you reserved.",
  },
  {
    title: "Accounts",
    body: "You sign in with an email code or through Telegram. Give accurate details and keep access to your inbox or Telegram account. One person per account. If something looks wrong, contact support so we can help.",
  },
  {
    title: "Bookings",
    body: "A slot is held only once it appears under My visits. Same-day bookings need at least 30 minutes of lead time and the calendar opens 60 days ahead. If two people request the same time, the earlier request keeps it.",
  },
  {
    title: "Changes and cancellations",
    body: "Cancel a future booking from My visits. Do it as early as you can so the barber can offer the chair to someone else. Repeated no-shows may limit your ability to book.",
  },
  {
    title: "Prices and payment",
    body: "Prices are shown in UZS before you confirm. Payment is settled with the barber at the shop unless a promotion states otherwise. The amount shown in your booking is the quoted price for that service at the time of booking.",
  },
  {
    title: "Reviews",
    body: "You can review a visit once it is marked completed, one review per booking. Reviews must describe your own experience. We may hide a review that is abusive or unrelated to the visit.",
  },
  {
    title: "Promotions",
    body: "Offers are published by barbers with their own conditions, such as a start date, end date or limit on uses. The conditions shown on the barber profile apply to that offer.",
  },
  {
    title: "Availability of the service",
    body: "We work to keep icone running, but hours, schedules and barbers can change. If a visit cannot go ahead as booked, we will tell you and help you find another time.",
  },
  {
    title: "Responsibility",
    body: "The barber is responsible for the service they provide. icone is responsible for the booking platform. Neither party is liable for losses that could not reasonably be expected from a haircut appointment.",
  },
  {
    title: "Changes to these terms",
    body: "We may update these terms as the service grows. The current version is always the one on this page, with the date shown below.",
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

        <p className="mt-6 text-sm leading-relaxed text-muted-foreground">
          These terms cover booking a chair through icone. They are the
          agreement between you and icone, and they sit alongside our privacy
          policy.
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

      <SiteFooter />
    </div>
  );
}
