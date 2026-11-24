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
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useBookings } from "@/lib/api/queries";
import {
  useCustomerOverview,
  useFavorites,
  useNotifications,
} from "@/lib/api/customer-queries";
import type { SessionUser } from "@/lib/auth/types";
import { useShopDate } from "@/lib/client/date";
import type { CustomerOverview } from "@/lib/domain/customer";
import { formatDate, formatPrice, label } from "@/lib/domain/time";
import type { Profile } from "@/lib/domain/types";
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

export function CustomerView({
  user,
  profile,
  initial,
}: {
  user: SessionUser;
  profile: Profile;
  initial: CustomerOverview;
}) {
  const todayDate = useShopDate();
  const bookings = useBookings();
  const favorites = useFavorites(initial.favorites);
  const notifications = useNotifications({
    notifications: initial.notifications,
    unread: initial.stats.unread,
  });

  const derived = useCustomerOverview({
    bookings: bookings.data ?? [],
    favorites: favorites.data ?? [],
    inbox: notifications.data ?? { notifications: [], unread: 0 },
    today: todayDate,
  });

  const warm = bookings.isPending || !todayDate;
  const stats = warm ? initial.stats : derived.stats;
  const next = warm ? initial.nextBooking : derived.nextBooking;
  const activity = warm ? initial.activity : derived.activity;
  const firstName = profile.name.split(/\s+/)[0] || "there";
  const contact = user.email ?? (user.telegramUsername ? `@${user.telegramUsername}` : "");

  return (
    <ClientGate role={profile.role}>
      <div className="space-y-8">
        <div className="space-y-1">
          <p className="text-xs font-medium tracking-[0.18em] text-brand-strong uppercase">
            Your space
          </p>
          <h2 className="text-2xl font-semibold tracking-[-0.04em]">
            Good to see you, {firstName}.
          </h2>
          <p className="text-sm text-muted-foreground">
            {contact ? `${contact} · ` : ""}Your next chair, saved barbers and
            the latest updates in one place.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Next appointment</CardTitle>
            <CardDescription>The chair you have reserved next.</CardDescription>
          </CardHeader>
          <CardContent>
            {warm && bookings.isPending ? (
              <Skeleton className="h-20 w-full" />
            ) : next ? (
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-lg font-medium">{next.serviceName}</p>
                    <Badge variant="secondary">{label(next.start)}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {next.barberName} · {formatDate(next.date)} · {next.serviceTime} min
                  </p>
                  <p className="text-sm font-medium tabular-nums">
                    {formatPrice(next.price)}
                  </p>
                </div>
                <Link
                  href="/bookings"
                  className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-9 rounded-xl")}
                >
                  Manage visit
                  <ArrowRight className="size-3.5" aria-hidden />
                </Link>
              </div>
            ) : (
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                  <p className="font-medium">No chair reserved yet.</p>
                  <p className="text-sm text-muted-foreground">
                    Pick a time and we will hold it for you.
                  </p>
                </div>
                <Link
                  href="/book"
                  className={cn(buttonVariants({ size: "sm" }), "h-9 rounded-xl")}
                >
                  <Scissors className="size-3.5" aria-hidden />
                  Book a chair
                </Link>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Upcoming" value={warm ? "—" : stats.upcoming} icon={CalendarDays} />
          <Stat label="Completed" value={warm ? "—" : stats.completed} icon={Star} />
          <Stat label="Saved chairs" value={favorites.data?.length ?? stats.favorites} icon={Heart} />
          <Stat label="Unread" value={notifications.data?.unread ?? stats.unread} icon={Bell} />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Saved barbers</CardTitle>
              <CardDescription>Chairs you come back to.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {favorites.isPending ? (
                <Skeleton className="h-16 w-full" />
              ) : (favorites.data ?? []).length === 0 ? (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    No saved barbers yet. Keep a favourite close for next time.
                  </p>
                  <Link
                    href="/barbers"
                    className="text-sm font-medium text-brand-strong hover:underline"
                  >
                    Browse barbers →
                  </Link>
                </div>
              ) : (
                <>
                  <ul className="divide-y divide-border/60">
                    {(favorites.data ?? []).slice(0, 3).map((item) => (
                      <li key={item.id} className="flex items-center gap-3 py-2 first:pt-0 last:pb-0">
                        <span
                          aria-hidden
                          className="size-10 shrink-0 rounded-full bg-muted bg-cover bg-center"
                          style={photoStyle(item.photo)}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{item.name}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {item.title || item.shop || "Barber"}
                          </p>
                        </div>
                        <Link
                          href={`/book?barber=${item.barber}`}
                          className="text-xs font-medium text-brand-strong hover:underline"
                        >
                          Book
                        </Link>
                      </li>
                    ))}
                  </ul>
                  <Link
                    href="/favorites"
                    className="inline-flex text-sm font-medium text-brand-strong hover:underline"
                  >
                    All saved chairs →
                  </Link>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Latest updates</CardTitle>
              <CardDescription>What changed since your last visit.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {notifications.isPending ? (
                <Skeleton className="h-16 w-full" />
              ) : (notifications.data?.notifications ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nothing new for now. We will let you know when there is.
                </p>
              ) : (
                <>
                  <ul className="divide-y divide-border/60">
                    {(notifications.data?.notifications ?? []).slice(0, 3).map((item) => (
                      <li key={item.id} className="py-2 first:pt-0 last:pb-0">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-medium">{item.title}</p>
                          {item.state === "unread" ? (
                            <span className="size-1.5 shrink-0 rounded-full bg-brand" aria-label="Unread" />
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
                    Open inbox →
                  </Link>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Activity</CardTitle>
            <CardDescription>Your recent visits, reviews and updates.</CardDescription>
          </CardHeader>
          <CardContent>
            {activity.length === 0 ? (
              <p className="py-2 text-sm text-muted-foreground">
                Nothing here yet. Your bookings will appear as you go.
              </p>
            ) : (
              <ol className="space-y-3">
                {activity.map((item) => (
                  <li key={item.id} className="flex gap-3 text-sm">
                    <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-brand" aria-hidden />
                    <div className="min-w-0">
                      <p className="font-medium">{item.title}</p>
                      {item.detail ? (
                        <p className="text-xs text-muted-foreground">{item.detail}</p>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>

        <Card size="sm">
          <CardContent className="flex flex-wrap gap-x-6 gap-y-3">
            <Link href="/bookings" className="flex items-center gap-2 text-sm font-medium hover:underline">
              <CalendarDays className="size-4 text-brand-strong" aria-hidden />
              My visits
            </Link>
            <Link href="/favorites" className="flex items-center gap-2 text-sm font-medium hover:underline">
              <Heart className="size-4 text-brand-strong" aria-hidden />
              Saved barbers
            </Link>
            <Link href="/settings" className="flex items-center gap-2 text-sm font-medium hover:underline">
              <Settings2 className="size-4 text-brand-strong" aria-hidden />
              Settings
            </Link>
            <Link href="/help" className="flex items-center gap-2 text-sm font-medium hover:underline">
              <Bell className="size-4 text-brand-strong" aria-hidden />
              Help
            </Link>
          </CardContent>
        </Card>
      </div>
    </ClientGate>
  );
}

function photoStyle(url: string) {
  if (!/^https?:\/\//.test(url)) return undefined;
  return { backgroundImage: `url("${url.replace(/"/g, "%22")}")` };
}
