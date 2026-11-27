"use client";

import { Loader2, MapPin } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { SignOutButton } from "@/components/auth/sign-out-button";
import { ImageUpload } from "@/components/upload/image-upload";
import { T } from "@/components/i18n/t";
import { useT } from "@/lib/i18n/use-t";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  useBarberSettings,
  useUpdateBarberSettings,
  type Barber,
  type NotificationPrefs,
} from "@/lib/api/barber-queries";
import type { Business } from "@/lib/domain/types";

import { Empty, FormError, LoadingRows, message, ToggleRow } from "./barber-ui";

/** The workspace is either an independent professional or a business. */
type Chair = Barber | Business;

type FormState = {
  name: string;
  title: string;
  bio: string;
  photo: string;
  logo: string;
  cover: string;
  shop: string;
  address: string;
  city: string;
  years: string;
  skills: string;
  phone: string;
  social: string;
  facilities: string;
  policy: string;
  lat: string;
  lng: string;
  active: boolean;
  confirm: boolean;
  featured: boolean;
};

function stateFrom(chair: Chair): FormState {
  return {
    name: chair.name,
    title: "title" in chair ? chair.title : "",
    bio: "bio" in chair ? chair.bio : "",
    photo: "photo" in chair ? chair.photo : "",
    logo: "logo" in chair ? chair.logo : "",
    cover: chair.cover,
    shop: "shop" in chair ? chair.shop : "",
    address: chair.address,
    city: chair.city,
    years: String("years" in chair ? chair.years : 0),
    skills: "skills" in chair ? chair.skills : "",
    phone: chair.phone,
    social: "social" in chair ? chair.social : "",
    facilities: chair.facilities,
    policy: chair.policy,
    lat: chair.lat ? String(chair.lat) : "",
    lng: chair.lng ? String(chair.lng) : "",
    active: chair.active,
    confirm: chair.confirm,
    featured: "featured" in chair ? chair.featured : false,
  };
}

function SettingsForm({
  chair,
  prefs,
}: {
  chair: Chair;
  prefs: NotificationPrefs;
}) {
  const save = useUpdateBarberSettings();
  const t = useT();
  const isBusiness = "logo" in chair;
  const [form, setForm] = useState<FormState>(() => stateFrom(chair));
  const [notificationPrefs, setNotificationPrefs] = useState(prefs);
  const [formError, setFormError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function setPref(key: keyof NotificationPrefs, value: boolean) {
    setNotificationPrefs((current) => ({ ...current, [key]: value }));
  }

  function useMyLocation() {
    setFormError(null);
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setFormError(t("work.settings.locationError"));
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        set("lat", position.coords.latitude.toFixed(6));
        set("lng", position.coords.longitude.toFixed(6));
        setLocating(false);
        toast.success(t("work.settings.locationFound"));
      },
      () => {
        setLocating(false);
        setFormError(t("work.settings.locationError"));
        toast.error(t("work.settings.locationError"));
      },
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    const years = Number(form.years);
    const lat = Number(form.lat);
    const lng = Number(form.lng);
    if (!form.name.trim()) {
      setFormError(t("work.settings.nameRequired"));
      return;
    }
    if (!Number.isInteger(years) || years < 0 || years > 80) {
      setFormError(t("work.settings.yearsInvalid"));
      return;
    }
    if (
      !Number.isFinite(lat) || lat < -90 || lat > 90 ||
      !Number.isFinite(lng) || lng < -180 || lng > 180
    ) {
      setFormError(t("work.settings.coordsInvalid"));
      return;
    }

    save.mutate(
      {
        profile: {
          name: form.name.trim(),
          title: form.title.trim(),
          bio: form.bio.trim(),
          photo: form.photo.trim(),
          logo: form.logo.trim(),
          cover: form.cover.trim(),
          shop: form.shop.trim(),
          address: form.address.trim(),
          city: form.city.trim(),
          years,
          skills: form.skills.trim(),
          phone: form.phone.trim(),
          social: form.social.trim(),
          facilities: form.facilities.trim(),
          policy: form.policy.trim(),
          lat,
          lng,
          active: form.active,
          confirm: form.confirm,
          featured: form.featured,
        },
        prefs: notificationPrefs,
      },
      {
        onSuccess: () => toast.success(t("work.toast.saved")),
        onError: (error) => {
          const text = message(error, t("work.toast.failed"));
          setFormError(text);
          toast.error(text);
        },
      },
    );
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <Card className="glass">
        <CardHeader>
          <CardTitle>
            <T k="work.settings.profile" />
          </CardTitle>
          <CardDescription>
            <T k="work.settings.profileHint" />
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="biz-name">
              <T k="common.name" />
            </Label>
            <Input
              id="biz-name"
              value={form.name}
              maxLength={64}
              onChange={(event) => set("name", event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="biz-title">
              <T k="work.settings.title" />
            </Label>
            <Input
              id="biz-title"
              value={form.title}
              maxLength={64}
              onChange={(event) => set("title", event.target.value)}
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="biz-bio">
              <T k="work.settings.bio" />
            </Label>
            <Textarea
              id="biz-bio"
              value={form.bio}
              maxLength={512}
              onChange={(event) => set("bio", event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            {isBusiness ? (
              <ImageUpload
                id="biz-logo"
                folder="logo"
                label={<T k="admin.image" />}
                value={form.logo}
                onChange={(id) => set("logo", id)}
              />
            ) : (
              <ImageUpload
                id="biz-photo"
                folder="avatar"
                label={<T k="work.settings.photo" />}
                value={form.photo}
                onChange={(id) => set("photo", id)}
              />
            )}
          </div>
          <div className="space-y-1.5">
            <ImageUpload
              id="biz-cover"
              folder="cover"
              label={<T k="work.settings.cover" />}
              value={form.cover}
              onChange={(id) => set("cover", id)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="biz-shop">
              <T k="work.settings.shop" />
            </Label>
            <Input
              id="biz-shop"
              value={form.shop}
              maxLength={64}
              onChange={(event) => set("shop", event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="biz-city">
              <T k="work.settings.city" />
            </Label>
            <Input
              id="biz-city"
              value={form.city}
              maxLength={64}
              onChange={(event) => set("city", event.target.value)}
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="biz-address">
              <T k="work.settings.address" />
            </Label>
            <Input
              id="biz-address"
              value={form.address}
              maxLength={128}
              onChange={(event) => set("address", event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="biz-years">
              <T k="work.settings.years" />
            </Label>
            <Input
              id="biz-years"
              type="number"
              min={0}
              max={80}
              value={form.years}
              onChange={(event) => set("years", event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="biz-phone">
              <T k="common.phone" />
            </Label>
            <Input
              id="biz-phone"
              value={form.phone}
              maxLength={32}
              onChange={(event) => set("phone", event.target.value)}
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="biz-skills">
              <T k="work.settings.skills" />
            </Label>
            <Input
              id="biz-skills"
              value={form.skills}
              maxLength={512}
              onChange={(event) => set("skills", event.target.value)}
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="biz-social">
              <T k="work.settings.social" />
            </Label>
            <Input
              id="biz-social"
              value={form.social}
              maxLength={512}
              onChange={(event) => set("social", event.target.value)}
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="biz-facilities">
              <T k="work.settings.facilities" />
            </Label>
            <Input
              id="biz-facilities"
              value={form.facilities}
              maxLength={512}
              onChange={(event) => set("facilities", event.target.value)}
            />
          </div>
          <div className="sm:col-span-2">
            <ToggleRow
              id="biz-active"
              label={t("work.settings.active")}
              hint={t("work.settings.activeHint")}
              checked={form.active}
              onChange={(value) => set("active", value)}
            />
            <ToggleRow
              id="biz-featured"
              label={t("work.settings.featured")}
              hint={t("work.settings.featuredHint")}
              checked={form.featured}
              onChange={(value) => set("featured", value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="glass">
        <CardHeader>
          <CardTitle>
            <T k="work.settings.location" />
          </CardTitle>
          <CardDescription>
            <T k="work.settings.locationHint" />
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="biz-lat">
              <T k="work.settings.latitude" />
            </Label>
            <Input
              id="biz-lat"
              type="number"
              inputMode="decimal"
              step="any"
              min={-90}
              max={90}
              placeholder="41.299500"
              value={form.lat}
              onChange={(event) => set("lat", event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="biz-lng">
              <T k="work.settings.longitude" />
            </Label>
            <Input
              id="biz-lng"
              type="number"
              inputMode="decimal"
              step="any"
              min={-180}
              max={180}
              placeholder="69.240100"
              value={form.lng}
              onChange={(event) => set("lng", event.target.value)}
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Button
              type="button"
              variant="outline"
              onClick={useMyLocation}
              disabled={locating || save.isPending}
            >
              {locating ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <MapPin className="size-4" aria-hidden />
              )}
              <T k={locating ? "work.settings.locating" : "work.settings.useMyLocation"} />
            </Button>
            <p className="text-xs text-muted-foreground">
              <T k="work.settings.coordsHint" />
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="glass">
        <CardHeader>
          <CardTitle>
            <T k="work.settings.policies" />
          </CardTitle>
          <CardDescription>
            <T k="work.settings.policiesHint" />
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <ToggleRow
            id="biz-confirm"
            label={t("work.settings.confirm")}
            hint={t("work.settings.confirmHint")}
            checked={form.confirm}
            onChange={(value) => set("confirm", value)}
          />
          <div className="space-y-1.5">
            <Label htmlFor="biz-policy">
              <T k="work.settings.policy" />
            </Label>
            <Textarea
              id="biz-policy"
              value={form.policy}
              maxLength={512}
              onChange={(event) => set("policy", event.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="glass">
        <CardHeader>
          <CardTitle>
            <T k="work.settings.notifications" />
          </CardTitle>
          <CardDescription>
            <T k="work.settings.notificationsHint" />
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ToggleRow
            id="pref-booking"
            label={t("work.settings.prefBooking")}
            checked={notificationPrefs.booking}
            onChange={(value) => setPref("booking", value)}
          />
          <ToggleRow
            id="pref-reminder"
            label={t("work.settings.prefReminder")}
            checked={notificationPrefs.reminder}
            onChange={(value) => setPref("reminder", value)}
          />
          <ToggleRow
            id="pref-waitlist"
            label={t("work.settings.prefWaitlist")}
            checked={notificationPrefs.waitlist}
            onChange={(value) => setPref("waitlist", value)}
          />
          <ToggleRow
            id="pref-business"
            label={t("work.settings.prefBusiness")}
            checked={notificationPrefs.business}
            onChange={(value) => setPref("business", value)}
          />
          <ToggleRow
            id="pref-marketing"
            label={t("work.settings.prefMarketing")}
            checked={notificationPrefs.marketing}
            onChange={(value) => setPref("marketing", value)}
          />
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" className="h-11" disabled={save.isPending}>
          <T k={save.isPending ? "common.loading" : "common.save"} />
        </Button>
        <Separator orientation="vertical" className="hidden h-8 sm:block" />
        <SignOutButton />
        <FormError text={formError} />
      </div>
    </form>
  );
}

export function BarberSettings() {
  const settings = useBarberSettings();
  const t = useT();

  if (settings.isPending) return <LoadingRows />;
  if (settings.isError) {
    return (
      <p role="alert" className="text-sm text-destructive">
        {message(settings.error, t("work.loadError"))}
      </p>
    );
  }
  if (!settings.data?.barber) {
    return <Empty>{t("work.settings.noProfile")}</Empty>;
  }

  return (
    <SettingsForm
      key={`${settings.data.barber.id}-${JSON.stringify(settings.data.prefs)}`}
      chair={settings.data.barber}
      prefs={settings.data.prefs}
    />
  );
}
