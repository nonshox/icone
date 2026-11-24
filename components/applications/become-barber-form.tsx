"use client";

import { Check, Loader2 } from "lucide-react";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

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
import { Textarea } from "@/components/ui/textarea";
import {
  useMyApplication,
  useSubmitApplication,
} from "@/lib/api/application-queries";

export function BecomeBarberForm() {
  const current = useMyApplication();
  const submit = useSubmitApplication();
  const [name, setName] = useState("");
  const [shop, setShop] = useState("");
  const [city, setCity] = useState("Tashkent");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [bio, setBio] = useState("");

  if (current.isPending) {
    return <Skeleton className="h-64 w-full" />;
  }

  const application = current.data;

  if (application?.state === "approved") {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Check className="size-4" aria-hidden /> You&apos;re approved
          </CardTitle>
          <CardDescription>Your chair is live.</CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/barber" className={buttonVariants({ size: "sm" })}>
            Open dashboard
          </Link>
        </CardContent>
      </Card>
    );
  }

  if (application?.state === "pending") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Application submitted</CardTitle>
          <CardDescription>We&apos;ll review it shortly.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {application.shop || application.name} · pending review
          </p>
        </CardContent>
      </Card>
    );
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    submit.mutate(
      { name, shop, city, address, phone, bio },
      {
        onSuccess: () => toast.success("Application sent"),
        onError: (error) =>
          toast.error(error instanceof Error ? error.message : "Try again."),
      },
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Apply</CardTitle>
        <CardDescription>Tell us about your chair.</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-3" onSubmit={onSubmit}>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="bb-name">Name</Label>
              <Input
                id="bb-name"
                required
                maxLength={64}
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bb-shop">Shop</Label>
              <Input
                id="bb-shop"
                maxLength={64}
                value={shop}
                onChange={(event) => setShop(event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bb-city">City</Label>
              <Input
                id="bb-city"
                maxLength={64}
                value={city}
                onChange={(event) => setCity(event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bb-phone">Phone</Label>
              <Input
                id="bb-phone"
                maxLength={32}
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bb-address">Address</Label>
            <Input
              id="bb-address"
              maxLength={128}
              value={address}
              onChange={(event) => setAddress(event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bb-bio">About you</Label>
            <Textarea
              id="bb-bio"
              maxLength={512}
              value={bio}
              onChange={(event) => setBio(event.target.value)}
            />
          </div>
          {current.isError ? (
            <p role="alert" className="text-sm text-destructive">
              Could not load your application. Try refreshing.
            </p>
          ) : null}
          <Button type="submit" disabled={submit.isPending} className="w-full">
            {submit.isPending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : null}
            Send application
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
