import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import {
  Award,
  CalendarDays,
  Clock3,
  ExternalLink,
  MapPin,
  Phone,
  Scissors,
  ShieldCheck,
  Sparkles,
  Star,
  Tag,
} from "lucide-react";

import { FavoriteButton } from "@/components/barbers/favorite-button";
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
import { TABLES } from "@/lib/appwrite/db";
import { getSlots } from "@/lib/domain/availability";
import { isFavorite, listPortfolio, listPromotions } from "@/lib/domain/customer";
import {
  getBarber,
  getMany,
  listHours,
  listReviews,
  listServices,
} from "@/lib/domain/data";
import { currentMember } from "@/lib/domain/member";
import { formatDate, formatPrice, label, nextDates } from "@/lib/domain/time";
import type { Review, Service, Slot } from "@/lib/domain/types";
import type { PortfolioItem, Promotion } from "@/lib/domain/customer";
import { cn } from "@/lib/utils";

type ReviewRow = Review & { userName: string };
type WindowRow = { day: number; start: number; end: number };
type SlotPreview = { date: string; slots: Slot[]; service: Service };

const DAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const barber = await getBarber(id);
  return {
    title: barber ? `${barber.name} · barber` : "Barber",
    description:
      barber?.bio ||
      "Meet the barber, see the menu and reserve a chair at icone in Tashkent.",
    robots: { index: false, follow: false },
  };
}

function photoStyle(url: string) {
  if (!/^https?:\/\//.test(url)) return undefined;
  return { backgroundImage: `url("${url.replace(/"/g, "%22")}")` };
}

function splitList(value: string): string[] {
  if (!value.trim()) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return parsed.filter((item): item is string => typeof item === "string");
    }
  } catch {
    // Plain comma- or line-separated text is the common case.
  }
  return value
    .split(/[,\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function Stars({ rate }: { rate: number }) {
  const rounded = Math.round(rate);
  return (
    <span className="inline-flex items-center gap-0.5" role="img" aria-label={`${rate} out of 5`}>
      {Array.from({ length: 5 }).map((_, index) => (
        <Star
          key={index}
          aria-hidden
          className={cn(
            "size-3.5",
            index < rounded ? "fill-brand text-brand" : "text-muted-foreground/50",
          )}
        />
      ))}
    </span>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="py-2 text-sm leading-relaxed text-muted-foreground">{children}</p>;
}

async function nearbySlots(id: string, service: Service): Promise<SlotPreview | null> {
  for (const date of nextDates(3)) {
    const slots = await getSlots({ barber: id, date, time: service.time });
    if (slots.length > 0) return { date, slots, service };
  }
  return null;
}

async function BarberDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const barber = await getBarber(id);
  if (!barber || !barber.active) notFound();

  const [hours, reviews, allServices, portfolio, promotions, member] =
    await Promise.all([
      listHours(id),
      listReviews(id),
      listServices(),
      listPortfolio(id),
      listPromotions(id),
      currentMember(),
    ]);

  const [users, saved] = await Promise.all([
    getMany(
      TABLES.users,
      reviews.map((review) => review.user),
    ),
    member?.profile.role === "client"
      ? isFavorite(member.user.id, id)
      : Promise.resolve(false),
  ]);

  const names = new Map(users.map((row) => [row.$id, String(row.name)]));
  const reviewRows: ReviewRow[] = reviews.map((review) => ({
    ...review,
    userName: names.get(review.user) ?? "Member",
  }));

  const menu = allServices.filter(
    (service) => !service.barber || service.barber === id,
  );
  const previewService = menu.find((service) => service.featured) ?? menu[0];
  const preview = previewService ? await nearbySlots(id, previewService) : null;

  return (
    <div className="grid gap-4 lg:grid-cols-[1.35fr_0.65fr]">
      <div className="space-y-4">
        <Card className="overflow-hidden">
          <div
            aria-hidden
            className="h-32 w-full bg-muted bg-cover bg-center sm:h-44"
            style={photoStyle(barber.cover || barber.photo)}
          />
          <CardContent className="pt-0">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-start gap-4">
                <span
                  aria-hidden
                  className="-mt-9 size-20 shrink-0 rounded-full bg-muted bg-cover bg-center ring-4 ring-card"
                  style={photoStyle(barber.photo)}
                />
                <div className="min-w-0 pt-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-2xl font-semibold tracking-[-0.04em]">
                      {barber.name}
                    </h2>
                    {barber.featured ? <Badge variant="secondary">Featured</Badge> : null}
                  </div>
                  <p className="text-sm text-brand-strong">
                    {barber.title || "Barber"}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    {barber.rating > 0 ? (
                      <span className="flex items-center gap-1.5">
                        <Stars rate={barber.rating} />
                        <span className="font-medium tabular-nums text-foreground">
                          {barber.rating.toFixed(1)}
                        </span>
                        <span>({reviews.length})</span>
                      </span>
                    ) : null}
                    {barber.years > 0 ? (
                      <span className="flex items-center gap-1.5">
                        <Award className="size-3.5" aria-hidden />
                        {barber.years} years
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <FavoriteButton barber={barber.id} initialSaved={saved} />
                <Link
                  href={`/book?barber=${barber.id}`}
                  className={cn(
                    buttonVariants({ size: "sm" }),
                    "brand-glow h-9 rounded-xl",
                  )}
                >
                  <CalendarDays className="size-3.5" aria-hidden />
                  Book this chair
                </Link>
              </div>
            </div>

            {(barber.shop || barber.address || barber.city) && (
              <p className="mt-5 flex items-start gap-2 text-sm text-muted-foreground">
                <MapPin className="mt-0.5 size-4 shrink-0 text-brand-strong" aria-hidden />
                {[barber.shop, barber.address, barber.city || "Tashkent"]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            )}

            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              {barber.bio || "Precision cuts and a calm chair."}
            </p>

            {splitList(barber.skills).length > 0 ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {splitList(barber.skills).map((skill) => (
                  <Badge key={skill} variant="outline">
                    <Scissors className="size-3" aria-hidden />
                    {skill}
                  </Badge>
                ))}
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Section
          title="Services"
          description="Prices in UZS. Duration includes the consultation."
        >
          {menu.length === 0 ? (
            <Empty>The menu for this chair is being updated.</Empty>
          ) : (
            <ul className="divide-y divide-border/60">
              {menu.map((service) => (
                <li
                  key={service.id}
                  className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-start sm:justify-between"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{service.name}</p>
                      {service.featured ? <Badge variant="secondary">Popular</Badge> : null}
                      {service.discount > 0 ? (
                        <Badge variant="outline">{service.discount}% off</Badge>
                      ) : null}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {service.category || "Hair"} · {service.time} min
                    </p>
                    {service.note ? (
                      <p className="text-sm text-muted-foreground">{service.note}</p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 items-center gap-4">
                    <p className="font-medium tabular-nums">{formatPrice(service.price)}</p>
                    <Link
                      href={`/book?barber=${barber.id}&service=${service.id}`}
                      className="text-xs font-medium text-brand-strong hover:underline"
                    >
                      Book →
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Recent work" description="A look at the chair's portfolio.">
          {portfolio.length === 0 ? (
            <Empty>No photos have been added yet. Ask the barber at your visit.</Empty>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {portfolio.map((item: PortfolioItem) => (
                <li key={item.id} className="overflow-hidden rounded-xl bg-muted">
                  <div
                    aria-hidden
                    className="h-40 w-full bg-cover bg-center"
                    style={photoStyle(item.url)}
                  />
                  {item.note ? (
                    <p className="px-3 py-2 text-xs text-muted-foreground">{item.note}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Reviews" description="From members who sat in this chair.">
          {reviewRows.length === 0 ? (
            <Empty>
              No reviews yet. Leave one after your first visit to this chair.
            </Empty>
          ) : (
            <ul className="divide-y divide-border/60">
              {reviewRows.map((review) => (
                <li key={review.id} className="space-y-1 py-4 first:pt-0 last:pb-0">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-medium">{review.userName}</span>
                    <Stars rate={review.rate} />
                  </div>
                  {review.note ? (
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      {review.note}
                    </p>
                  ) : null}
                  <p className="text-xs text-muted-foreground">
                    {formatDate(review.created.slice(0, 10))}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>

      <div className="space-y-4">
        <Section title="Opening hours" description="Tashkent time, weekly schedule.">
          {hours.length === 0 ? (
            <Empty>Hours are being updated. Check the booking calendar for open times.</Empty>
          ) : (
            <ul className="divide-y divide-border/60">
              {hours
                .slice()
                .sort((a: WindowRow, b: WindowRow) => a.day - b.day)
                .map((row) => (
                  <li
                    key={row.day}
                    className="flex items-center justify-between gap-3 py-2.5 text-sm first:pt-0 last:pb-0"
                  >
                    <span className="text-muted-foreground">{DAYS[row.day] ?? "Day"}</span>
                    <span className="font-medium tabular-nums">
                      {label(row.start)}–{label(row.end)}
                    </span>
                  </li>
                ))}
            </ul>
          )}
        </Section>

        <Section
          title="Next open times"
          description={preview ? `${formatDate(preview.date)} · ${preview.service.name}` : undefined}
        >
          {preview ? (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {preview.slots.slice(0, 10).map((slot) => (
                  <Link
                    key={slot.start}
                    href={`/book?barber=${barber.id}&service=${preview.service.id}`}
                    className={cn(
                      buttonVariants({ variant: "outline", size: "sm" }),
                      "h-8 rounded-lg px-2.5 tabular-nums",
                    )}
                  >
                    {slot.label}
                  </Link>
                ))}
              </div>
              <Link
                href={`/book?barber=${barber.id}`}
                className="inline-flex items-center gap-1 text-sm font-medium text-brand-strong hover:underline"
              >
                See all times
                <ExternalLink className="size-3.5" aria-hidden />
              </Link>
            </div>
          ) : (
            <Empty>
              No free times in the next few days. The booking calendar has the
              full schedule.
            </Empty>
          )}
        </Section>

        <Section title="Offers" description="Active promotions from this barber.">
          {promotions.length === 0 ? (
            <Empty>No offers running right now.</Empty>
          ) : (
            <ul className="space-y-3">
              {promotions.map((offer: Promotion) => (
                <li key={offer.id} className="rounded-xl bg-muted/60 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <p className="flex items-center gap-1.5 font-medium">
                      <Tag className="size-3.5 text-brand-strong" aria-hidden />
                      {offer.name}
                    </p>
                    <Badge variant="secondary">
                      {offer.kind === "percent"
                        ? `${offer.amount}% off`
                        : `${formatPrice(offer.amount)} off`}
                    </Badge>
                  </div>
                  {offer.note ? (
                    <p className="mt-1 text-sm text-muted-foreground">{offer.note}</p>
                  ) : null}
                  {(offer.start || offer.end) && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {offer.start || "Now"} – {offer.end || "Until withdrawn"}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Good to know" description="Policies, facilities and contact.">
          {splitList(barber.facilities).length === 0 &&
          !barber.policy &&
          !barber.phone &&
          !barber.social ? (
            <Empty>Extra details for this chair have not been added yet.</Empty>
          ) : (
            <div className="space-y-4">
              {splitList(barber.facilities).length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {splitList(barber.facilities).map((item) => (
                    <Badge key={item} variant="outline">
                      <Sparkles className="size-3" aria-hidden />
                      {item}
                    </Badge>
                  ))}
                </div>
              ) : null}
              {barber.policy ? (
                <div className="flex gap-2 text-sm leading-relaxed text-muted-foreground">
                  <ShieldCheck className="mt-0.5 size-4 shrink-0 text-brand-strong" aria-hidden />
                  <p>{barber.policy}</p>
                </div>
              ) : null}
              {barber.phone ? (
                <a
                  href={`tel:${barber.phone.replace(/[^\d+]/g, "")}`}
                  className="flex items-center gap-2 text-sm font-medium hover:underline"
                >
                  <Phone className="size-4 text-brand-strong" aria-hidden />
                  {barber.phone}
                </a>
              ) : null}
              {barber.social ? (
                /^https?:\/\//.test(barber.social) ? (
                  <a
                    href={barber.social}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="flex items-center gap-2 text-sm font-medium hover:underline"
                  >
                    <ExternalLink className="size-4 text-brand-strong" aria-hidden />
                    Social profile
                  </a>
                ) : (
                  <p className="flex items-center gap-2 text-sm text-muted-foreground">
                    <ExternalLink className="size-4 text-brand-strong" aria-hidden />
                    {barber.social}
                  </p>
                )
              ) : null}
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                <Clock3 className="size-3.5" aria-hidden />
                {barber.confirm
                  ? "This chair confirms each booking before it is final."
                  : "Your booking is confirmed as soon as you reserve it."}
              </p>
            </div>
          )}
        </Section>
      </div>
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="grid gap-4 lg:grid-cols-[1.35fr_0.65fr]" aria-hidden>
      <div className="space-y-4">
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-56 w-full" />
      </div>
      <div className="space-y-4">
        <Skeleton className="h-56 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
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

      <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">
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
