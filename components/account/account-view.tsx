"use client";

import {
  Bell,
  BriefcaseBusiness,
  CalendarDays,
  Clock,
  Heart,
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
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { SessionUser } from "@/lib/auth/types";
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

/**
 * The one account home. Editing lives only on `/settings`, visits/saved/
 * messages keep their own pages, and the professional CTA appears once in the
 * shared navigation — never repeated here.
 */
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
  const contact =
    profile.phone ||
    user.email ||
    (user.telegramUsername ? `@${user.telegramUsername}` : "—");

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
                <CardDescription className="truncate">{contact}</CardDescription>
              </div>
              <Badge variant="outline" className="ml-auto shrink-0">
                <T k={roleKey[profile.role]} />
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            {/* /settings is the only editable profile form. */}
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

      <Card size="sm">
        <CardHeader>
          <CardTitle><T k="work.dashboard.quick" /></CardTitle>
          <CardDescription><T k="account.subtitle" /></CardDescription>
        </CardHeader>
        <CardContent className="grid gap-1">
          {profile.role === "admin" ? (
            <Link
              href="/admin"
              className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm font-medium hover:bg-muted"
            >
              <ShieldCheck className="size-4" aria-hidden />
              <T k="account.adminDashboard" />
            </Link>
          ) : null}
          {professional ? (
            <Link
              href="/barber"
              className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm font-medium text-brand-strong hover:bg-brand/5"
            >
              <BriefcaseBusiness className="size-4" aria-hidden />
              <T k="nav.workspace" />
            </Link>
          ) : null}
          <Link
            href="/bookings"
            className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm font-medium hover:bg-muted"
          >
            <CalendarDays className="size-4" aria-hidden />
            <T k="nav.myVisits" />
          </Link>
          <Link
            href="/favorites"
            className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm font-medium hover:bg-muted"
          >
            <Heart className="size-4" aria-hidden />
            <T k="nav.saved" />
          </Link>
          <Link
            href="/messages"
            className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm font-medium hover:bg-muted"
          >
            <MessageSquare className="size-4" aria-hidden />
            <T k="nav.messages" />
          </Link>
          <Link
            href="/notifications"
            className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm font-medium hover:bg-muted"
          >
            <Bell className="size-4" aria-hidden />
            <T k="nav.inbox" />
          </Link>
          <Link
            href="/waits"
            className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm font-medium hover:bg-muted"
          >
            <Clock className="size-4" aria-hidden />
            <T k="nav.waitlist" />
          </Link>
          <Link
            href="/book"
            className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm font-medium hover:bg-muted"
          >
            <Scissors className="size-4" aria-hidden />
            <T k="nav.book" />
          </Link>
          <Link
            href="/settings"
            className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm font-medium hover:bg-muted"
          >
            <Settings className="size-4" aria-hidden />
            <T k="nav.settings" />
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
