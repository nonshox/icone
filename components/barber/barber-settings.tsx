"use client";

import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { SignOutButton } from "@/components/auth/sign-out-button";
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

import { FormError, LoadingRows, message, ToggleRow } from "./barber-ui";

type FormState = {
  name: string;
  title: string;
  bio: string;
  photo: string;
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
  active: boolean;
  confirm: boolean;
  featured: boolean;
};

function stateFrom(chair: Barber): FormState {
  return {
    name: chair.name,
    title: chair.title,
    bio: chair.bio,
    photo: chair.photo,
    cover: chair.cover,
    shop: chair.shop,
    address: chair.address,
    city: chair.city,
    years: String(chair.years),
    skills: chair.skills,
    phone: chair.phone,
    social: chair.social,
    facilities: chair.facilities,
    policy: chair.policy,
    active: chair.active,
    confirm: chair.confirm,
    featured: chair.featured,
  };
}

function SettingsForm({
  chair,
  prefs,
}: {
  chair: Barber;
  prefs: NotificationPrefs;
}) {
  const save = useUpdateBarberSettings();
  const [form, setForm] = useState<FormState>(() => stateFrom(chair));
  const [notificationPrefs, setNotificationPrefs] = useState(prefs);
  const [formError, setFormError] = useState<string | null>(null);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    const years = Number(form.years);
    if (!form.name.trim()) {
      setFormError("Add the name members see.");
      return;
    }
    if (!Number.isInteger(years) || years < 0 || years > 80) {
      setFormError("Years on the chair must be between 0 and 80.");
      return;
    }

    save.mutate(
      {
        profile: {
          name: form.name.trim(),
          title: form.title.trim(),
          bio: form.bio.trim(),
          photo: form.photo.trim(),
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
          active: form.active,
          confirm: form.confirm,
          featured: form.featured,
        },
        prefs: notificationPrefs,
      },
      {
        onSuccess: () => toast.success("Settings saved"),
        onError: (error) => {
          setFormError(message(error, "Could not save your settings."));
          toast.error("Could not save your settings");
        },
      },
    );
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <Card className="glass">
        <CardHeader>
          <CardTitle>Public profile</CardTitle>
          <CardDescription>What members see.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="biz-name">Name</Label>
            <Input id="biz-name" value={form.name} maxLength={64} onChange={(e) => set("name", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="biz-title">Title</Label>
            <Input id="biz-title" value={form.title} maxLength={64} onChange={(e) => set("title", e.target.value)} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="biz-bio">Bio</Label>
            <Textarea id="biz-bio" value={form.bio} maxLength={512} onChange={(e) => set("bio", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="biz-photo">Photo link</Label>
            <Input id="biz-photo" type="url" value={form.photo} maxLength={512} onChange={(e) => set("photo", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="biz-cover">Cover link</Label>
            <Input id="biz-cover" type="url" value={form.cover} maxLength={512} onChange={(e) => set("cover", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="biz-shop">Shop</Label>
            <Input id="biz-shop" value={form.shop} maxLength={64} onChange={(e) => set("shop", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="biz-city">City</Label>
            <Input id="biz-city" value={form.city} maxLength={64} onChange={(e) => set("city", e.target.value)} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="biz-address">Address</Label>
            <Input id="biz-address" value={form.address} maxLength={128} onChange={(e) => set("address", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="biz-years">Years on the chair</Label>
            <Input id="biz-years" type="number" min={0} max={80} value={form.years} onChange={(e) => set("years", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="biz-phone">Phone</Label>
            <Input id="biz-phone" value={form.phone} maxLength={32} onChange={(e) => set("phone", e.target.value)} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="biz-skills">Skills</Label>
            <Input id="biz-skills" value={form.skills} maxLength={512} onChange={(e) => set("skills", e.target.value)} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="biz-social">Social links</Label>
            <Input id="biz-social" value={form.social} maxLength={512} onChange={(e) => set("social", e.target.value)} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="biz-facilities">Facilities</Label>
            <Input id="biz-facilities" value={form.facilities} maxLength={512} onChange={(e) => set("facilities", e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <ToggleRow id="biz-active" label="Active" hint="Hidden when off." checked={form.active} onChange={(v) => set("active", v)} />
            <ToggleRow id="biz-featured" label="Featured" hint="Highlighted in the directory." checked={form.featured} onChange={(v) => set("featured", v)} />
          </div>
        </CardContent>
      </Card>

      <Card className="glass">
        <CardHeader>
          <CardTitle>Booking policies</CardTitle>
          <CardDescription>Shown before booking.</CardDescription>
        </CardHeader>
        <CardContent>
          <ToggleRow
            id="biz-confirm"
            label="Confirm each booking"
            hint="Approve new bookings first."
            checked={form.confirm}
            onChange={(v) => set("confirm", v)}
          />
          <div className="space-y-1.5">
            <Label htmlFor="biz-policy">Policy</Label>
            <Textarea id="biz-policy" value={form.policy} maxLength={512} onChange={(e) => set("policy", e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card className="glass">
        <CardHeader>
          <CardTitle>Notifications</CardTitle>
          <CardDescription>Your preferences.</CardDescription>
        </CardHeader>
        <CardContent>
          <ToggleRow id="pref-bookings" label="New bookings" checked={notificationPrefs.newBookings} onChange={(v) => setNotificationPrefs((current) => ({ ...current, newBookings: v }))} />
          <ToggleRow id="pref-cancellations" label="Cancellations" checked={notificationPrefs.cancellations} onChange={(v) => setNotificationPrefs((current) => ({ ...current, cancellations: v }))} />
          <ToggleRow id="pref-reviews" label="Reviews" checked={notificationPrefs.reviews} onChange={(v) => setNotificationPrefs((current) => ({ ...current, reviews: v }))} />
          <ToggleRow id="pref-reminders" label="Reminders" checked={notificationPrefs.reminders} onChange={(v) => setNotificationPrefs((current) => ({ ...current, reminders: v }))} />
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" className="h-11" disabled={save.isPending}>
          {save.isPending ? "Saving…" : "Save settings"}
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

  if (settings.isPending) return <LoadingRows />;
  if (settings.isError) {
    return <p role="alert" className="text-sm text-destructive">{message(settings.error, "Could not load your settings.")}</p>;
  }
  if (!settings.data) return null;

  return (
    <SettingsForm
      key={`${settings.data.chair.id}-${JSON.stringify(settings.data.prefs)}`}
      chair={settings.data.chair}
      prefs={settings.data.prefs}
    />
  );
}
