"use client";

import {
  BriefcaseBusiness,
  CalendarDays,
  Clock,
  Heart,
  LayoutDashboard,
  MessageSquare,
  Scissors,
  Settings,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import Link from "next/link";

import { useT } from "@/lib/i18n/use-t";

import { T } from "@/components/i18n/t";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { EmptyState, LoadingRows } from "@/components/ui/app-state";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { useBookings } from "@/lib/api/queries";
import { useShopDate } from "@/lib/client/date";
import type { SessionUser } from "@/lib/auth/types";
import { formatDate, label } from "@/lib/domain/time";
import type { Profile, Role } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

/** One localized role label, shared with the admin role controls. */
const roleKey: Record<Role, string> = {
  client: "admin.clients",
  barber: "admin.barberAccounts",
  admin: "admin.adminAccounts",
};

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function AccountView({
  user,
  profile,
  professional,
}: {
  user: SessionUser;
  profile: Profile;
  /** An approved professional row/membership, independent of the role label. */
  professional: boolean;
}) {
  const t = useT();
  const bookings = useBookings();
  const todayDate = useShopDate();

  const all = bookings.data ?? [];
  const upcoming = todayDate
    ? all.filter(
        (booking) =>
          ["pending", "confirmed"].includes(booking.status) &&
          booking.date >= todayDate,
      )
    : [];
  const done = all.filter((booking) => booking.status === "done");
  const next = upcoming[0];

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_0.9fr]">
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <span className="grid size-11 place-items-center rounded-full bg-muted text-sm font-medium">
                {initials(profile.name) || <UserRound className="size-4" />}
              </span>
              <div className="min-w-0">
                <CardTitle className="truncate">{profile.name}</CardTitle>
                <CardDescription className="truncate">
                  {user.email ??
                    (user.telegramUsername ? `@${user.telegramUsername}` : "—")}
                </CardDescription>
              </div>
              <Badge variant="outline" className="ml-auto">
                <T k={roleKey[profile.role]} />
              </Badge>
            </div>
          </CardHeader>

          {/* /settings is the only editable profile form. */}
          <CardContent>
            <Link
              href="/settings"
              className={cn(
                buttonVariants({ variant: "outline", size: "sm" }),
                "rounded-lg",
              )}
            >
              <Settings className="size-3.5" aria-hidden />
              <T k="nav.settings" />
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="size-4" aria-hidden />
              <T k="account.signInMethod" />
            </CardTitle>
            <CardDescription>
              {user.provider === "telegram"
                ? t("settings.telegram")
                : user.provider === "email"
                  ? t("settings.emailCode")
                  : t("settings.member")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SignOutButton />
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>{t("visits.upcoming")}</CardTitle>
          </CardHeader>
          <CardContent>
            {bookings.isPending || !todayDate ? (
              <LoadingRows count={1} rowClassName="h-16 w-full" />
            ) : next ? (
              <div className="space-y-2">
                <p className="font-medium">{next.serviceName}</p>
                <p className="text-sm text-muted-foreground">
                  {next.barberName} · {formatDate(next.date)} ·{" "}
                  {label(next.start)}
                </p>
                <Link
                  href="/bookings"
                  className={cn(
                    buttonVariants({ variant: "outline", size: "sm" }),
                    "mt-1 rounded-lg",
                  )}
                >
                  <T k="visits.manage" />
                </Link>
              </div>
            ) : (
              <EmptyState
                action={
                  <Link
                    href="/book"
                    className={cn(buttonVariants({ size: "sm" }), "rounded-lg")}
                  >
                    <Scissors className="size-3.5" aria-hidden />
                    <T k="nav.book" />
                  </Link>
                }
              >
                {t("visits.nothingBooked")}
              </EmptyState>
            )}
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 gap-4">
          <StatCard
            label={t("common.upcoming")}
            value={todayDate ? upcoming.length : "—"}
          />
          <StatCard
            label={t("common.completed")}
            value={bookings.isPending ? "—" : done.length}
          />
        </div>

        <Card size="sm">
          <CardContent className="space-y-2">
            {profile.role === "admin" ? (
              <Link
                href="/admin"
                className="flex items-center gap-2 text-sm font-medium hover:underline"
              >
                <ShieldCheck className="size-4" aria-hidden />
                <T k="account.adminDashboard" />
              </Link>
            ) : null}
            {professional ? (
              <Link
                href="/barber"
                className="flex items-center gap-2 text-sm font-medium text-brand-strong hover:underline"
              >
                <BriefcaseBusiness className="size-4" aria-hidden />
                <T k="nav.workspace" />
              </Link>
            ) : null}
            <Link
              href="/customer"
              className="flex items-center gap-2 text-sm font-medium hover:underline"
            >
              <LayoutDashboard className="size-4" aria-hidden />
              <T k="account.customerHome" />
            </Link>
            <Link
              href="/bookings"
              className="flex items-center gap-2 text-sm font-medium hover:underline"
            >
              <CalendarDays className="size-4" aria-hidden />
              <T k="nav.myVisits" />
            </Link>
            <Link
              href="/favorites"
              className="flex items-center gap-2 text-sm font-medium hover:underline"
            >
              <Heart className="size-4" aria-hidden />
              <T k="nav.saved" />
            </Link>
            <Link
              href="/messages"
              className="flex items-center gap-2 text-sm font-medium hover:underline"
            >
              <MessageSquare className="size-4" aria-hidden />
              <T k="nav.messages" />
            </Link>
            <Link
              href="/waits"
              className="flex items-center gap-2 text-sm font-medium hover:underline"
            >
              <Clock className="size-4" aria-hidden />
              <T k="nav.waitlist" />
            </Link>
            <Link
              href="/book"
              className="flex items-center gap-2 text-sm font-medium hover:underline"
            >
              <Scissors className="size-4" aria-hidden />
              <T k="nav.book" />
            </Link>
            {!professional && profile.role !== "admin" ? (
              <Link
                href="/become-barber"
                className="flex items-center gap-2 text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
              >
                <UserRound className="size-3.5" aria-hidden />
                <T k="nav.becomeBarber" />
              </Link>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
