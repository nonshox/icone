"use client";

import { Check, Loader2 } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
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
  type Application,
  useMyApplication,
  useSaveApplicationDraft,
  useSubmitApplication,
} from "@/lib/api/application-queries";
import { useMe } from "@/lib/api/queries";
import { useT } from "@/lib/i18n/use-t";
import type { Role } from "@/lib/domain/types";

function isStaff(role: Role | undefined): boolean {
  return role === "barber" || role === "admin";
}

function failure(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

/**
 * The editable form. It mounts only after the application query resolves, so
 * its initial state is the saved draft — coming back later restores every
 * field the applicant already entered.
 */
function ApplicationForm({
  application,
  initialModel,
  loadError,
}: {
  application: Application | null;
  initialModel: "a" | "b";
  loadError: boolean;
}) {
  const submit = useSubmitApplication();
  const draft = useSaveApplicationDraft();
  const t = useT();

  const [model, setModel] = useState<"a" | "b">(application?.model ?? initialModel);
  const [name, setName] = useState(application?.name ?? "");
  const [shop, setShop] = useState(application?.shop ?? "");
  const [city, setCity] = useState(application?.city || "Tashkent");
  const [address, setAddress] = useState(application?.address ?? "");
  const [phone, setPhone] = useState(application?.phone ?? "");
  const [bio, setBio] = useState(application?.bio ?? "");
  const [draftSaved, setDraftSaved] = useState(false);

  const infoNeeded = application?.appState === "info";
  const busy = submit.isPending || draft.isPending;
  const values = { model, name, shop, city, address, phone, bio };

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setDraftSaved(false);
    submit.mutate(values, {
      onSuccess: () => toast.success(t("apply.live")),
      onError: (error) => toast.error(failure(error, t("apply.tryAgain"))),
    });
  }

  function onSaveDraft() {
    setDraftSaved(false);
    draft.mutate(values, {
      onSuccess: () => {
        setDraftSaved(true);
        toast.success(t("apply.draftSaved"));
      },
      onError: (error) => toast.error(failure(error, t("apply.tryAgain"))),
    });
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
          {infoNeeded ? (
            <div
              role="alert"
              className="space-y-1 rounded-xl border border-border px-3 py-2 text-sm"
            >
              <p className="font-medium">
                <T k="apply.infoTitle" />
              </p>
              {application?.note ? (
                <p className="text-muted-foreground">{application.note}</p>
              ) : null}
            </div>
          ) : null}
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">
              <T k="apply.modelTitle" />
            </legend>
            <div className="grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                aria-pressed={model === "a"}
                onClick={() => setModel("a")}
                className={`rounded-xl border p-3 text-left text-sm transition-colors ${
                  model === "a" ? "border-brand bg-brand/10" : "border-border hover:bg-muted"
                }`}
              >
                <span className="block font-medium">
                  <T k="apply.modelA" />
                </span>
                <span className="mt-1 block text-xs text-muted-foreground">
                  <T k="apply.modelAHint" />
                </span>
              </button>
              <button
                type="button"
                aria-pressed={model === "b"}
                onClick={() => setModel("b")}
                className={`rounded-xl border p-3 text-left text-sm transition-colors ${
                  model === "b" ? "border-brand bg-brand/10" : "border-border hover:bg-muted"
                }`}
              >
                <span className="block font-medium">
                  <T k="apply.modelB" />
                </span>
                <span className="mt-1 block text-xs text-muted-foreground">
                  <T k="apply.modelBHint" />
                </span>
              </button>
            </div>
          </fieldset>
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
          {loadError ? (
            <p role="alert" className="text-sm text-destructive">
              <T k="apply.loadError" />
            </p>
          ) : null}
          <div className="grid gap-2 sm:grid-cols-2">
            <Button type="submit" disabled={busy} className="h-11 w-full">
              {submit.isPending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : null}
              <T k={submit.isPending ? "apply.sending" : "apply.submit"} />
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={onSaveDraft}
              disabled={busy}
              className="h-11 w-full"
            >
              {draft.isPending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : null}
              <T k={draft.isPending ? "common.loading" : "apply.saveDraft"} />
            </Button>
          </div>
          <p role="status" className="text-sm text-muted-foreground">
            <T k={draftSaved ? "apply.draftSaved" : "apply.draftHint"} />
          </p>
        </form>
      </CardContent>
    </Card>
  );
}

/**
 * Promotion is decided by three signals, not one: the account role, the
 * professional/membership flag from `/api/me`, and an approved application.
 * Approval now sets the role, but an interrupted promotion can leave any one
 * of them lagging behind, so any of the three unlocks the workspace.
 */
export function BecomeBarberForm() {
  const current = useMyApplication();
  const me = useMe();
  const params = useSearchParams();

  if (current.isPending || me.isPending) {
    return <Skeleton className="h-64 w-full" />;
  }

  const application = current.data;
  const role = me.data?.profile.role;
  const approved =
    application?.appState === "approved" || application?.state === "approved";
  const promoted = isStaff(role) || me.data?.professional === true || approved;
  const dashboard = role === "admin" ? "/admin" : "/barber";

  if (promoted) {
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

  // `info` is editable — the applicant must answer the reviewer's note.
  const state = application?.appState ?? application?.state;
  if (application && ["submitted", "review"].includes(state ?? "")) {
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

  return (
    <ApplicationForm
      application={application ?? null}
      initialModel={params.get("model") === "b" ? "b" : "a"}
      loadError={current.isError}
    />
  );
}
