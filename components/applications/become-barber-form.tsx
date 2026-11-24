"use client";

import { Check, Loader2 } from "lucide-react";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { T } from "@/components/i18n/t";
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
import { useProfile } from "@/lib/api/queries";
import { useT } from "@/lib/i18n/use-t";
import type { Role } from "@/lib/domain/types";

function isStaff(role: Role | undefined): boolean {
  return role === "barber" || role === "admin";
}

/**
 * The member's role is the authority on whether the switch happened. The
 * application record can still say "pending" if approval was interrupted, so
 * both are consulted before showing the apply form again.
 */
export function BecomeBarberForm() {
  const current = useMyApplication();
  const profile = useProfile();
  const submit = useSubmitApplication();
  const t = useT();
  const [name, setName] = useState("");
  const [shop, setShop] = useState("");
  const [city, setCity] = useState("Tashkent");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [bio, setBio] = useState("");

  if (current.isPending || profile.isPending) {
    return <Skeleton className="h-64 w-full" />;
  }

  const application = current.data;
  const promoted = isStaff(profile.data?.role);
  const dashboard = profile.data?.role === "admin" ? "/admin" : "/barber";

  if (promoted || application?.state === "approved") {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Check className="size-4" aria-hidden />
            <T k="apply.approvedTitle" />
          </CardTitle>
          <CardDescription>
            <T k="apply.approvedBody" />
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Link href={dashboard} className={buttonVariants({ size: "sm" })}>
            <T k="apply.dashboard" />
          </Link>
          {application?.note ? (
            <p className="text-sm text-muted-foreground">{application.note}</p>
          ) : null}
        </CardContent>
      </Card>
    );
  }

  if (application?.state === "pending") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>
            <T k="apply.pendingTitle" />
          </CardTitle>
          <CardDescription>
            <T k="apply.pendingBody" />
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {application.shop || application.name} · <T k="apply.pendingReview" />
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
        onSuccess: () => toast.success(t("apply.live")),
        onError: (error) =>
          toast.error(error instanceof Error ? error.message : t("apply.tryAgain")),
      },
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <T k="apply.formTitle" />
        </CardTitle>
        <CardDescription>
          <T k="apply.formSubtitle" />
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-3" onSubmit={onSubmit}>
          {application?.state === "rejected" ? (
            <p
              role="alert"
              className="rounded-xl border border-border px-3 py-2 text-sm text-muted-foreground"
            >
              {application.note || t("apply.rejectedBody")}
            </p>
          ) : null}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="bb-name">
                <T k="apply.name" />
              </Label>
              <Input
                id="bb-name"
                required
                maxLength={64}
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bb-shop">
                <T k="apply.shop" />
              </Label>
              <Input
                id="bb-shop"
                maxLength={64}
                value={shop}
                onChange={(event) => setShop(event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bb-city">
                <T k="apply.city" />
              </Label>
              <Input
                id="bb-city"
                maxLength={64}
                value={city}
                onChange={(event) => setCity(event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bb-phone">
                <T k="apply.phone" />
              </Label>
              <Input
                id="bb-phone"
                maxLength={32}
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bb-address">
              <T k="apply.address" />
            </Label>
            <Input
              id="bb-address"
              maxLength={128}
              value={address}
              onChange={(event) => setAddress(event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bb-bio">
              <T k="apply.about" />
            </Label>
            <Textarea
              id="bb-bio"
              maxLength={512}
              value={bio}
              onChange={(event) => setBio(event.target.value)}
            />
          </div>
          {current.isError ? (
            <p role="alert" className="text-sm text-destructive">
              <T k="apply.loadError" />
            </p>
          ) : null}
          <Button type="submit" disabled={submit.isPending} className="w-full">
            {submit.isPending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : null}
            <T k={submit.isPending ? "apply.sending" : "apply.submit"} />
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
