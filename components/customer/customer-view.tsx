"use client";

import {
  ArrowRight,
  Bell,
  CalendarDays,
  Heart,
  Scissors,
  Settings2,
  Star,
} from "lucide-react";
import Link from "next/link";

import { ClientGate } from "@/components/customer/client-gate";
import { T } from "@/components/i18n/t";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useCustomerOverview,
  useFavorites,
  useNotifications,
} from "@/lib/api/customer-queries";
import { useBarbers, useBookings, useProfile } from "@/lib/api/queries";
import { useShopDate } from "@/lib/client/date";
import { imageUrl } from "@/lib/client/files";
import { useT } from "@/lib/i18n/use-t";
import { formatDate, formatPrice, label } from "@/lib/domain/time";
import { cn } from "@/lib/utils";

function Stat({ label: name, value, icon: Icon }: {
  label: string;
  value: number | string;
  icon: typeof Bell;
}) {
  return (
    <Card size="sm">
      <CardContent className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs text-muted-foreground">{name}</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
        </div>
        <Icon className="size-4 text-brand-strong" aria-hidden />
      </CardContent>
    </Card>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-8" aria-hidden>
      <Skeleton className="h-8 w-52" />
      <Skeleton className="h-36 w-full" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-20 w-full" />
        ))}
      </div>
      <Skeleton className="h-56 w-full" />
    </div>
  );
}

function photoStyle(value: string) {
  const url = imageUrl(value);
  if (!/^https?:\/\//.test(url)) return undefined;
  return { backgroundImage: `url("${url.replace(/"/g, "%22")}")` };
}

export function CustomerView() {
  const t = useT();
  const todayDate = useShopDate();
  const profile = useProfile();
  const bookings = useBookings();
  const favorites = useFavorites();
  const notifications = useNotifications();
  const barbers = useBarbers();

  const derived = useCustomerOverview({
    bookings: bookings.data ?? [],
    favorites: favorites.data ?? [],
    inbox: notifications.data ?? { notifications: [], unread: 0 },
    today: todayDate,
  });

  if (profile.isPending || !todayDate) return <DashboardSkeleton />;

  if (profile.isError || !profile.data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t("common.error")}</CardTitle>
          <CardDescription><T k="customer.loadError" /></CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const firstName = profile.data.name.split(/\s+/)[0] || t("settings.member");
  const saved = favorites.data ?? [];
  const barberById = new Map((barbers.data ?? []).map((barber) => [barber.id, barber]));
  const inbox = notifications.data?.notifications ?? [];

  return (
    <ClientGate role={profile.data.role}>
      <div className="space-y-8">
        <div className="space-y-1">
          <p className="text-xs font-medium tracking-[0.18em] text-brand-strong uppercase">
            <T k="customer.eyebrow" />
          </p>
          <h2 className="text-2xl font-semibold tracking-[-0.04em]">
            {t("customer.greeting")}, {firstName}.
          </h2>
          {profile.data.phone ? (
            <p className="text-sm text-muted-foreground">{profile.data.phone}</p>
          ) : null}
        </div>

        <Card>
          <CardHeader>
            <CardTitle><T k="customer.nextVisit" /></CardTitle>
            <CardDescription><T k="customer.nextVisitBody" /></CardDescription>
          </CardHeader>
          <CardContent>
            {bookings.isPending ? (
              <Skeleton className="h-20 w-full" />
            ) : bookings.isError ? (
              <p role="alert" className="text-sm text-destructive">
                {t("visits.loadError")}
              </p>
            ) : derived.nextBooking ? (
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-lg font-medium">{derived.nextBooking.serviceName}</p>
                    <Badge variant="secondary">{label(derived.nextBooking.start)}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {derived.nextBooking.barberName} · {formatDate(derived.nextBooking.date)} ·{" "}
                    {derived.nextBooking.end - derived.nextBooking.start}{" "}
                    {t("common.minutes")}
                  </p>
                  <p className="text-sm font-medium tabular-nums">
                    {formatPrice(derived.nextBooking.price)}
                  </p>
                </div>
                <Link
                  href="/bookings"
                  className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-9 rounded-xl")}
                >
                  <T k="customer.manage" />
                  <ArrowRight className="size-3.5" aria-hidden />
                </Link>
              </div>
            ) : (
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="font-medium"><T k="customer.noChair" /></p>
                <Link
                  href="/book"
                  className={cn(buttonVariants({ size: "sm" }), "h-9 rounded-xl")}
                >
                  <Scissors className="size-3.5" aria-hidden />
                  <T k="customer.bookChair" />
                </Link>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat
            label={t("customer.upcoming")}
            value={bookings.isPending ? "—" : derived.stats.upcoming}
            icon={CalendarDays}
          />
          <Stat
            label={t("customer.completed")}
            value={bookings.isPending ? "—" : derived.stats.completed}
            icon={Star}
          />
          <Stat
            label={t("customer.savedChairs")}
            value={favorites.isPending ? "—" : favorites.data?.length ?? 0}
            icon={Heart}
          />
          <Stat
            label={t("customer.unread")}
            value={notifications.isPending ? "—" : notifications.data?.unread ?? 0}
            icon={Bell}
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle><T k="customer.savedBarbers" /></CardTitle>
              <CardDescription><T k="customer.savedBody" /></CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {favorites.isPending ? (
                <Skeleton className="h-16 w-full" />
              ) : favorites.isError ? (
                <p role="alert" className="text-sm text-destructive">
                  <T k="favorites.loadError" />
                </p>
              ) : saved.length === 0 ? (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground"><T k="customer.noSaved" /></p>
                  <Link
                    href="/barbers"
                    className="text-sm font-medium text-brand-strong hover:underline"
                  >
                    {t("customer.browseBarbers")} →
                  </Link>
                </div>
              ) : (
                <>
                  <ul className="divide-y divide-border/60">
                    {saved.slice(0, 3).map((item) => {
                      const barber = barberById.get(item.barber);
                      return (
                        <li key={item.id} className="flex items-center gap-3 py-2 first:pt-0 last:pb-0">
                          <span
                            aria-hidden
                            className="size-10 shrink-0 rounded-full bg-muted bg-cover bg-center"
                            style={photoStyle(item.photo ?? barber?.photo ?? "")}
                          />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">
                              {item.name ?? barber?.name ?? t("favorites.barberFallback")}
                            </p>
                            <p className="truncate text-xs text-muted-foreground">
                              {barber?.title || barber?.shop || t("favorites.barberFallback")}
                            </p>
                          </div>
                          <Link
                            href={`/book?barber=${item.barber}`}
                            className="text-xs font-medium text-brand-strong hover:underline"
                          >
                            <T k="customer.book" />
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                  <Link
                    href="/favorites"
                    className="inline-flex text-sm font-medium text-brand-strong hover:underline"
                  >
                    {t("customer.allSaved")} →
                  </Link>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle><T k="customer.latest" /></CardTitle>
              <CardDescription><T k="customer.latestBody" /></CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {notifications.isPending ? (
                <Skeleton className="h-16 w-full" />
              ) : notifications.isError ? (
                <p role="alert" className="text-sm text-destructive">
                  <T k="inbox.loadError" />
                </p>
              ) : inbox.length === 0 ? (
                <p className="text-sm text-muted-foreground"><T k="customer.noUpdates" /></p>
              ) : (
                <>
                  <ul className="divide-y divide-border/60">
                    {inbox.slice(0, 3).map((item) => (
                      <li key={item.id} className="py-2 first:pt-0 last:pb-0">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-medium">{item.title}</p>
                          {item.state === "new" ? (
                            <span className="size-1.5 shrink-0 rounded-full bg-brand" aria-label={t("inbox.new")} />
                          ) : null}
                        </div>
                        {item.body ? (
                          <p className="line-clamp-2 text-xs text-muted-foreground">{item.body}</p>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                  <Link
                    href="/notifications"
                    className="inline-flex text-sm font-medium text-brand-strong hover:underline"
                  >
                    {t("customer.openInbox")} →
                  </Link>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle><T k="customer.activity" /></CardTitle>
            <CardDescription><T k="customer.activityBody" /></CardDescription>
          </CardHeader>
          <CardContent>
            {derived.activity.length === 0 ? (
              <p className="py-2 text-sm text-muted-foreground"><T k="customer.noActivity" /></p>
            ) : (
              <ol className="space-y-3">
                {derived.activity.map((item) => {
                  const bookingId = item.id.startsWith("booking-")
                    ? item.id.slice("booking-".length)
                    : "";
                  const booking = bookings.data?.find((row) => row.id === bookingId);
                  const title =
                    item.kind === "review" ? t("visits.reviewed") : item.title;
                  const detail =
                    item.kind === "review"
                      ? t("visits.reviewedThis")
                      : booking
                        ? `${booking.barberName} · ${t(`status.${booking.status}`)}`
                        : item.detail;
                  return (
                    <li key={item.id} className="flex gap-3 text-sm">
                      <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-brand" aria-hidden />
                      <div className="min-w-0">
                        <p className="font-medium">{title}</p>
                        {detail ? (
                          <p className="text-xs text-muted-foreground">{detail}</p>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </CardContent>
        </Card>

        <Card size="sm">
          <CardContent className="flex flex-wrap gap-x-6 gap-y-3">
            <Link href="/bookings" className="flex items-center gap-2 text-sm font-medium hover:underline">
              <CalendarDays className="size-4 text-brand-strong" aria-hidden />
              <T k="customer.myVisits" />
            </Link>
            <Link href="/favorites" className="flex items-center gap-2 text-sm font-medium hover:underline">
              <Heart className="size-4 text-brand-strong" aria-hidden />
              <T k="customer.savedBarbers" />
            </Link>
            <Link href="/settings" className="flex items-center gap-2 text-sm font-medium hover:underline">
              <Settings2 className="size-4 text-brand-strong" aria-hidden />
              <T k="customer.settings" />
            </Link>
            <Link href="/help" className="flex items-center gap-2 text-sm font-medium hover:underline">
              <Bell className="size-4 text-brand-strong" aria-hidden />
              <T k="customer.help" />
            </Link>
            <Link href="/become-barber" className="flex items-center gap-2 text-sm font-medium hover:underline">
              <Scissors className="size-4 text-brand-strong" aria-hidden />
              <T k="customer.becomeBarber" />
            </Link>
          </CardContent>
        </Card>
      </div>
    </ClientGate>
  );
}
