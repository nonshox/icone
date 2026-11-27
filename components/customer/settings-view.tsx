"use client";

import { Bell, Loader2, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { T } from "@/components/i18n/t";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { ClientGate } from "@/components/customer/client-gate";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useSettings,
  useUpdateSettings,
  type SettingsData,
} from "@/lib/api/customer-queries";
import { useProfile } from "@/lib/api/queries";
import { useT } from "@/lib/i18n/use-t";
import type { NotificationPrefs, Role } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

const prefRows: Array<{
  key: keyof NotificationPrefs;
  labelKey: string;
  hintKey: string;
}> = [
  { key: "booking", labelKey: "settings.pref.booking", hintKey: "settings.pref.bookingHint" },
  { key: "reminder", labelKey: "settings.pref.reminder", hintKey: "settings.pref.reminderHint" },
  { key: "waitlist", labelKey: "settings.pref.waitlist", hintKey: "settings.pref.waitlistHint" },
  { key: "business", labelKey: "settings.pref.business", hintKey: "settings.pref.businessHint" },
  { key: "marketing", labelKey: "settings.pref.marketing", hintKey: "settings.pref.marketingHint" },
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

function SettingsForm({
  data,
  role,
  profilePhone,
}: {
  data: SettingsData;
  role: Role;
  profilePhone: string;
}) {
  const t = useT();
  const update = useUpdateSettings();

  const [name, setName] = useState(data.profile.name);
  const [phone, setPhone] = useState(data.profile.phone);
  const [avatar, setAvatar] = useState(data.profile.avatar);
  const [prefs, setPrefs] = useState<NotificationPrefs>(data.prefs);

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
          toast.success(t("settings.saved"));
        },
        onError: (error) =>
          toast.error(t("settings.failed"), {
            description: error instanceof Error ? error.message : t("auth.tryAgain"),
          }),
      },
    );
  }

  return (
    <ClientGate role={role}>
      <div className="grid gap-4 lg:grid-cols-[1fr_0.8fr]">
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle><T k="settings.details" /></CardTitle>
              <CardDescription><T k="settings.detailsBody" /></CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={save}>
                <div className="space-y-2">
                  <Label htmlFor="settings-name"><T k="settings.displayName" /></Label>
                  <Input
                    id="settings-name"
                    value={name}
                    maxLength={64}
                    required
                    onChange={(event) => setName(event.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="settings-phone"><T k="common.phone" /></Label>
                  <Input
                    id="settings-phone"
                    value={phone}
                    maxLength={32}
                    inputMode="tel"
                    placeholder="+998 90 000 00 00"
                    onChange={(event) => setPhone(event.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    <T k="settings.phoneHint" />
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="settings-avatar"><T k="settings.avatar" /></Label>
                  <Input
                    id="settings-avatar"
                    value={avatar}
                    type="url"
                    maxLength={512}
                    placeholder="https://…"
                    onChange={(event) => setAvatar(event.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    <T k="settings.avatarHint" />
                  </p>
                </div>

                <Button type="submit" size="sm" className="h-9 rounded-xl" disabled={update.isPending}>
                  {update.isPending ? (
                    <Loader2 className="size-3.5 animate-spin" aria-hidden />
                  ) : null}
                  <T k="settings.save" />
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="size-4 text-brand-strong" aria-hidden />
                <T k="settings.notifications" />
              </CardTitle>
              <CardDescription><T k="settings.notificationsBody" /></CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="divide-y divide-border/60">
                {prefRows.map((row) => (
                  <li key={row.key} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{t(row.labelKey)}</p>
                      <p className="text-xs text-muted-foreground">{t(row.hintKey)}</p>
                    </div>
                    <Toggle
                      checked={prefs[row.key]}
                      label={t(row.labelKey)}
                      onChange={(value) => setPrefs((current) => (current ? { ...current, [row.key]: value } : current))}
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
                <T k="settings.account" />
              </CardTitle>
              <CardDescription><T k="settings.accountBody" /></CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="text-muted-foreground"><T k="settings.role" /></span>
                <Badge variant="outline">{t(`role.${role}`)}</Badge>
              </div>
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="text-muted-foreground"><T k="settings.contact" /></span>
                <span className="max-w-[60%] truncate">
                  {profilePhone || t("common.member")}
                </span>
              </div>
              <SignOutButton />
            </CardContent>
          </Card>

          <Card size="sm">
            <CardContent className="space-y-2">
              <Link href="/customer" className="block text-sm font-medium hover:underline">
                {t("settings.homeLink")} →
              </Link>
              <Link href="/bookings" className="block text-sm font-medium hover:underline">
                {t("settings.visitsLink")} →
              </Link>
              <Link href="/help" className="block text-sm font-medium hover:underline">
                {t("settings.helpLink")} →
              </Link>
              <Link href="/become-barber" className="block text-sm font-medium hover:underline">
                {t("settings.applyLink")} →
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </ClientGate>
  );
}

export function SettingsView() {
  const t = useT();
  const profile = useProfile();
  const settings = useSettings();

  if (profile.isPending || settings.isPending) {
    return (
      <div className="grid gap-4 lg:grid-cols-[1fr_0.8fr]" aria-hidden>
        <Skeleton className="h-80 w-full" />
        <Skeleton className="h-80 w-full" />
      </div>
    );
  }

  if (profile.isError || settings.isError || !profile.data || !settings.data) {
    return (
      <Card>
        <CardContent role="alert" className="py-10 text-center text-sm text-destructive">
          {t("settings.loadError")}
        </CardContent>
      </Card>
    );
  }

  const data = settings.data;
  return (
    <SettingsForm
      key={`${data.profile.name}|${data.profile.phone}|${JSON.stringify(data.prefs)}`}
      data={data}
      role={profile.data.role}
      profilePhone={profile.data.phone}
    />
  );
}
