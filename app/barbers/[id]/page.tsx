import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getBarber, listHours, listReviews } from "@/lib/domain/data";
import { label } from "@/lib/domain/time";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Barber",
  robots: { index: false, follow: false },
};

const DAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

async function BarberDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const barber = await getBarber(id);
  if (!barber || !barber.active) notFound();

  const [hours, reviews] = await Promise.all([
    listHours(id),
    listReviews(id),
  ]);

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_0.8fr]">
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle className="text-xl">{barber.name}</CardTitle>
                <CardDescription>{barber.title || "Barber"}</CardDescription>
              </div>
              {barber.rating > 0 ? (
                <Badge variant="secondary">{barber.rating.toFixed(1)} ★</Badge>
              ) : null}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm leading-relaxed text-muted-foreground">
              {barber.bio || "Precision cuts and a calm chair."}
            </p>
            <Link
              href={`/book?barber=${barber.id}`}
              className={cn(buttonVariants({ size: "sm" }), "rounded-lg")}
            >
              Book this chair
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Reviews</CardTitle>
            <CardDescription>
              {reviews.length === 0
                ? "No reviews yet."
                : `${reviews.length} visit${reviews.length === 1 ? "" : "s"} rated.`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {reviews.length === 0 ? (
              <p className="py-4 text-sm text-muted-foreground">
                Be the first to leave a review after your visit.
              </p>
            ) : (
              <ul className="divide-y divide-border/60">
                {reviews.map((review) => (
                  <li key={review.id} className="py-3 first:pt-0 last:pb-0">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-medium">
                        {review.userName || "Member"}
                      </span>
                      <Badge variant="outline">{review.rate} / 5</Badge>
                    </div>
                    {review.note ? (
                      <p className="mt-1 text-sm text-muted-foreground">
                        {review.note}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Opening hours</CardTitle>
          <CardDescription>Tashkent time.</CardDescription>
        </CardHeader>
        <CardContent>
          {hours.length === 0 ? (
            <p className="py-4 text-sm text-muted-foreground">
              Hours are being updated. Check back soon.
            </p>
          ) : (
            <ul className="divide-y divide-border/60">
              {hours
                .slice()
                .sort((a, b) => a.day - b.day)
                .map((row) => (
                  <li
                    key={row.day}
                    className="flex items-center justify-between py-3 text-sm first:pt-0 last:pb-0"
                  >
                    <span className="text-muted-foreground">{DAYS[row.day]}</span>
                    <span className="font-medium tabular-nums">
                      {label(row.start)}–{label(row.end)}
                    </span>
                  </li>
                ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_0.8fr]" aria-hidden>
      <Skeleton className="h-72 w-full" />
      <Skeleton className="h-72 w-full" />
    </div>
  );
}

export default function BarberPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />

      <main id="main" className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">
        <Link
          href="/barbers"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← All barbers
        </Link>

        <div className="mt-4">
          <Suspense fallback={<DetailSkeleton />}>
            <BarberDetail params={params} />
          </Suspense>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
