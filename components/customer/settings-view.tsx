"use client";

import { Bell, Loader2, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { SignOutButton } from "@/components/auth/sign-out-button";
import { ClientGate } from "@/components/customer/client-gate";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useSettings, useUpdateSettings } from "@/lib/api/customer-queries";
import type { SessionUser } from "@/lib/auth/types";
import type { NotifyPrefs, SettingsData } from "@/lib/domain/customer";
import type { Profile, Role } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

const roleLabel: Record<Role, string> = {
  client: "Client",
  barber: "Barber",
  admin: "Admin",
};

const prefRows: Array<{
  key: keyof NotifyPrefs;
  label: string;
  hint: string;
}> = [
  {
    key: "bookings",
    label: "Booking updates",
    hint: "When a chair is confirmed, changed or cancelled.",
  },
  {
    key: "reminders",
    label: "Visit reminders",
    hint: "A short nudge before an appointment.",
  },
  {
    key: "offers",
    label: "Offers",
    hint: "Promotions from the barbers you follow.",
  },
];

function Toggle({
  checked,
  label,
  onChange,
}: {
  checked: boolean;
  label: string;
  onChange: (value: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative h-6 w-11 shrink-0 rounded-full border transition-colors focus-visible:ring-3 focus-visible:ring-ring/50",
        checked
          ? "border-brand bg-brand"
          : "border-border bg-muted",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "absolute top-0.5 size-4.5 rounded-full bg-background shadow-sm transition-transform",
          checked ? "translate-x-5.5" : "translate-x-0.5",
        )}
      />
    </button>
  );
}

export function SettingsView({
  user,
  profile,
  initial,
}: {
  user: SessionUser;
  profile: Profile;
  initial: SettingsData;
}) {
  const settings = useSettings(initial);
  const update = useUpdateSettings();

  const [name, setName] = useState(initial.profile.name);
  const [phone, setPhone] = useState(initial.profile.phone);
  const [avatar, setAvatar] = useState(initial.profile.avatar);
  const [prefs, setPrefs] = useState<NotifyPrefs>(initial.prefs);

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    update.mutate(
      {
        name: name.trim(),
        phone: phone.trim(),
        avatar: avatar.trim(),
        prefs,
      },
      {
        onSuccess: (saved) => {
          setName(saved.profile.name);
          setPhone(saved.profile.phone);
          setAvatar(saved.profile.avatar);
          setPrefs(saved.prefs);
          toast.success("Settings saved");
        },
        onError: (error) =>
          toast.error("Could not save", {
            description: error instanceof Error ? error.message : "Please try again.",
          }),
      },
    );
  }

  return (
    <ClientGate role={profile.role}>
      <div className="grid gap-4 lg:grid-cols-[1fr_0.8fr]">
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Your details</CardTitle>
              <CardDescription>Shown on your bookings.</CardDescription>
            </CardHeader>
            <CardContent>
              {settings.isPending ? (
                <Skeleton className="h-64 w-full" />
              ) : (
                <form className="space-y-4" onSubmit={save}>
                  <div className="space-y-2">
                    <Label htmlFor="settings-name">Display name</Label>
                    <Input
                      id="settings-name"
                      value={name}
                      maxLength={64}
                      required
                      onChange={(event) => setName(event.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="settings-phone">Phone</Label>
                    <Input
                      id="settings-phone"
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

                  <div className="space-y-2">
                    <Label htmlFor="settings-avatar">Avatar link</Label>
                    <Input
                      id="settings-avatar"
                      value={avatar}
                      type="url"
                      maxLength={512}
                      placeholder="https://…"
                      onChange={(event) => setAvatar(event.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Leave empty for initials.
                    </p>
                  </div>

                  <Button type="submit" size="sm" className="h-9 rounded-xl" disabled={update.isPending}>
                    {update.isPending ? (
                      <Loader2 className="size-3.5 animate-spin" aria-hidden />
                    ) : null}
                    Save settings
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="size-4 text-brand-strong" aria-hidden />
                Notifications
              </CardTitle>
              <CardDescription>Choose what reaches you.</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="divide-y divide-border/60">
                {prefRows.map((row) => (
                  <li key={row.key} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{row.label}</p>
                      <p className="text-xs text-muted-foreground">{row.hint}</p>
                    </div>
                    <Toggle
                      checked={prefs[row.key]}
                      label={row.label}
                      onChange={(value) => setPrefs((current) => ({ ...current, [row.key]: value }))}
                    />
                  </li>
                ))}
              </ul>

            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="size-4 text-brand-strong" aria-hidden />
                Account
              </CardTitle>
              <CardDescription>Sign-in and access.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="text-muted-foreground">Role</span>
                <Badge variant="outline">{roleLabel[profile.role]}</Badge>
              </div>
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="text-muted-foreground">Sign-in</span>
                <span>
                  {user.provider === "telegram"
                    ? "Telegram"
                    : user.provider === "email"
                      ? "Email code"
                      : "Member"}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="text-muted-foreground">Contact</span>
                <span className="max-w-[60%] truncate">
                  {user.email ?? (user.telegramUsername ? `@${user.telegramUsername}` : "—")}
                </span>
              </div>
              <SignOutButton />
            </CardContent>
          </Card>

          <Card size="sm">
            <CardContent className="space-y-2">
              <Link href="/customer" className="block text-sm font-medium hover:underline">
                Your space →
              </Link>
              <Link href="/bookings" className="block text-sm font-medium hover:underline">
                My visits →
              </Link>
              <Link href="/help" className="block text-sm font-medium hover:underline">
                Help →
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </ClientGate>
  );
}
