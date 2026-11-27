"use client";

import {
  BriefcaseBusiness,
  CalendarDays,
  Clock,
  Heart,
  LayoutDashboard,
  Loader2,
  MessageSquare,
  Scissors,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { useState, type FormEvent } from "react";

import { useT } from "@/lib/i18n/use-t";
import { toast } from "sonner";

import { T } from "@/components/i18n/t";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useBookings, useUpdateProfile } from "@/lib/api/queries";
import { useShopDate } from "@/lib/client/date";
import type { SessionUser } from "@/lib/auth/types";
import { formatDate, label } from "@/lib/domain/time";
import type { Profile, Role } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

const roleLabel: Record<Role, string> = {
  client: "Client",
  barber: "Barber",
  admin: "Admin",
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
  const update = useUpdateProfile();
  const bookings = useBookings();
  const [name, setName] = useState(profile.name);
  const [phone, setPhone] = useState(profile.phone);
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

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    update.mutate(
      { name: name.trim(), phone: phone.trim() },
      {
        onSuccess: (saved) => {
          setName(saved.name);
          setPhone(saved.phone);
          toast.success(t("common.saved"));
        },
        onError: (error) =>
          toast.error(t("settings.failed"), {
            description:
              error instanceof Error ? error.message : t("auth.tryAgain"),
          }),
      },
    );
  }

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
                  {user.email ?? (user.telegramUsername ? `@${user.telegramUsername}` : "No contact on file")}
                </CardDescription>
              </div>
              <Badge variant="outline" className="ml-auto">
                {roleLabel[profile.role]}
              </Badge>
            </div>
          </CardHeader>

          <CardContent>
            <form className="space-y-4" onSubmit={save}>
              <div className="space-y-2">
                <Label htmlFor="name"><T k="account.name" /></Label>
                <Input
                  id="name"
                  value={name}
                  maxLength={64}
                  required
                  onChange={(event) => setName(event.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone"><T k="account.phone" /></Label>
                <Input
                  id="phone"
                  value={phone}
                  maxLength={32}
                  inputMode="tel"
                  placeholder="+998 90 000 00 00"
                  onChange={(event) => setPhone(event.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  For visit updates only.
                </p>
              </div>

              <Button type="submit" size="sm" disabled={update.isPending}>
                {update.isPending ? (
                  <Loader2 className="size-3.5 animate-spin" aria-hidden />
                ) : null}
                <T k="account.save" />
              </Button>
            </form>
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
                ? "Telegram"
                : user.provider === "email"
                  ? "Email code"
                  : "Member"}
              {" · secure cookie session"}
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
            <CardTitle>Next visit</CardTitle>
            <CardDescription>Your next visit.</CardDescription>
          </CardHeader>
          <CardContent>
            {bookings.isPending || !todayDate ? (
              <Skeleton className="h-16 w-full" />
            ) : next ? (
              <div className="space-y-2">
                <p className="font-medium">{next.serviceName}</p>
                <p className="text-sm text-muted-foreground">
                  {next.barberName} · {formatDate(next.date)} at{" "}
                  {label(next.start)}
                </p>
                <Link
                  href="/bookings"
                  className={cn(
                    buttonVariants({ variant: "outline", size: "sm" }),
                    "mt-1 rounded-lg",
                  )}
                >
                  Manage booking
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  No chair reserved yet.
                </p>
                <Link
                  href="/book"
                  className={cn(
                    buttonVariants({ size: "sm" }),
                    "rounded-lg",
                  )}
                >
                  <Scissors className="size-3.5" aria-hidden />
                  <T k="nav.book" />
                </Link>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 gap-4">
          <Card size="sm">
            <CardContent>
              <p className="text-xs text-muted-foreground">Upcoming</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">
                {todayDate ? upcoming.length : "—"}
              </p>
            </CardContent>
          </Card>
          <Card size="sm">
            <CardContent>
              <p className="text-xs text-muted-foreground">Completed</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">
                {bookings.isPending ? "—" : done.length}
              </p>
            </CardContent>
          </Card>
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
