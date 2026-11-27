"use client";

import { Loader2, Pencil } from "lucide-react";
import { Fragment, useState, type FormEvent, type ReactNode } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { T } from "@/components/i18n/t";
import { useT } from "@/lib/i18n/use-t";
import {
  useAdminBarbers,
  useAdminPortfolio,
  useDeletePortfolioItem,
  useSetBarberActive,
  useSetBarberFeatured,
  useUpdateBarber,
  type AdminBarber,
} from "@/lib/api/admin-queries";

import { Empty, FormError, LoadingRows, Section, message } from "./admin-ui";

type Draft = {
  name: string;
  title: string;
  bio: string;
  shop: string;
  city: string;
  address: string;
  phone: string;
  years: string;
  photo: string;
  skills: string;
  social: string;
  facilities: string;
  policy: string;
  confirm: boolean;
};

function draftFor(barber: AdminBarber): Draft {
  return {
    name: barber.name,
    title: barber.title,
    bio: barber.bio,
    shop: barber.shop,
    city: barber.city,
    address: barber.address,
    phone: barber.phone,
    years: String(barber.years ?? 0),
    photo: barber.photo,
    skills: barber.skills,
    social: barber.social,
    facilities: barber.facilities,
    policy: barber.policy,
    confirm: barber.confirm,
  };
}

export function BarbersView() {
  const t = useT();
  const list = useAdminBarbers();
  const portfolio = useAdminPortfolio();
  const active = useSetBarberActive();
  const featured = useSetBarberFeatured();
  const update = useUpdateBarber();
  const removeImage = useDeletePortfolioItem();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);

  const busy = active.isPending || featured.isPending || update.isPending;
  const error =
    errorText ??
    (list.error ? message(list.error, t("admin.loadError")) : null) ??
    (portfolio.error ? message(portfolio.error, t("admin.loadError")) : null) ??
    (removeImage.error ? message(removeImage.error, t("admin.saveError")) : null);

  function patch<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((current) => (current ? { ...current, [key]: value } : current));
  }

  function save(event: FormEvent<HTMLFormElement>, barber: AdminBarber) {
    event.preventDefault();
    if (!draft || !draft.name.trim()) {
      setErrorText(t("admin.nameError"));
      return;
    }
    setErrorText(null);
    update.mutate(
      {
        id: barber.id,
        name: draft.name,
        title: draft.title,
        bio: draft.bio,
        shop: draft.shop,
        city: draft.city,
        address: draft.address,
        phone: draft.phone,
        years: Number(draft.years) || 0,
        photo: draft.photo,
        skills: draft.skills,
        social: draft.social,
        facilities: draft.facilities,
        policy: draft.policy,
        confirm: draft.confirm,
      },
      {
        onSuccess: () => {
          setEditingId(null);
          setDraft(null);
          toast.success(t("admin.saved"));
        },
        onError: (cause) => {
          const text = message(cause, t("admin.saveError"));
          setErrorText(text);
          toast.error(text);
        },
      },
    );
  }

  const barbers = list.data ?? [];
  const names = new Map(barbers.map((item) => [item.id, item.name]));

  return (
    <div className="space-y-6">
      <Section title={<T k="admin.barbers.title" />} description={<T k="admin.barbers.description" />}>
        <FormError text={error} />

        {list.isPending ? (
          <LoadingRows />
        ) : barbers.length === 0 ? (
          <Empty><T k="admin.noBarbers" /></Empty>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead><T k="common.name" /></TableHead>
                  <TableHead><T k="admin.city" /></TableHead>
                  <TableHead><T k="common.status" /></TableHead>
                  <TableHead><T k="admin.featured" /></TableHead>
                  <TableHead className="text-right"><T k="admin.actions" /></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {barbers.map((barber) => (
                  <Fragment key={barber.id}>
                    <TableRow>
                      <TableCell>
                        <p className="font-medium">{barber.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {barber.title || barber.shop || "—"}
                        </p>
                      </TableCell>
                      <TableCell>{barber.city || "Tashkent"}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          <Badge variant={barber.active ? "secondary" : "outline"}>
                            {barber.active ? t("admin.active") : t("admin.offline")}
                          </Badge>
                          {barber.verified ? (
                            <Badge variant="outline"><T k="admin.verified" /></Badge>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={barber.featured ? "default" : "outline"}>
                          {barber.featured ? t("admin.featured") : t("admin.standard")}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-wrap justify-end gap-2">
                          <Button
                            type="button"
                            size="xs"
                            variant="outline"
                            disabled={busy}
                            onClick={() => {
                              const opening = editingId !== barber.id;
                              setEditingId(opening ? barber.id : null);
                              setDraft(opening ? draftFor(barber) : null);
                            }}
                          >
                            {editingId === barber.id ? (
                              <T k="common.cancel" />
                            ) : (
                              <>
                                <Pencil className="size-3" aria-hidden />
                                <T k="common.edit" />
                              </>
                            )}
                          </Button>
                          <Button
                            type="button"
                            size="xs"
                            variant="outline"
                            disabled={busy}
                            onClick={() =>
                              featured.mutate(
                                { id: barber.id, featured: !barber.featured },
                                {
                                  onSuccess: () => toast.success(t("admin.saved")),
                                  onError: (cause) =>
                                    toast.error(message(cause, t("admin.saveError"))),
                                },
                              )
                            }
                          >
                            {barber.featured ? <T k="admin.unfeature" /> : <T k="admin.feature" />}
                          </Button>
                          <Button
                            type="button"
                            size="xs"
                            variant="outline"
                            disabled={busy}
                            onClick={() =>
                              active.mutate(
                                { id: barber.id, active: !barber.active },
                                {
                                  onSuccess: () => toast.success(t("admin.saved")),
                                  onError: (cause) =>
                                    toast.error(message(cause, t("admin.saveError"))),
                                },
                              )
                            }
                          >
                            {active.isPending ? (
                              <Loader2 className="size-3 animate-spin" aria-hidden />
                            ) : null}
                            {barber.active ? <T k="admin.suspend" /> : <T k="admin.reactivate" />}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                    {editingId === barber.id && draft ? (
                      <TableRow>
                        <TableCell colSpan={5}>
                          <form
                            onSubmit={(event) => save(event, barber)}
                            className="grid gap-3 rounded-lg border bg-muted/30 p-3 sm:grid-cols-2"
                          >
                            <Field label={<T k="common.name" />}>
                              <Input
                                value={draft.name}
                                maxLength={64}
                                onChange={(event) => patch("name", event.target.value)}
                              />
                            </Field>
                            <Field label={<T k="admin.barberTitle" />}>
                              <Input
                                value={draft.title}
                                maxLength={64}
                                onChange={(event) => patch("title", event.target.value)}
                              />
                            </Field>
                            <Field label={<T k="admin.bio" />}>
                              <Textarea
                                value={draft.bio}
                                maxLength={1024}
                                onChange={(event) => patch("bio", event.target.value)}
                              />
                            </Field>
                            <Field label={<T k="admin.shop" />}>
                              <Input
                                value={draft.shop}
                                maxLength={64}
                                onChange={(event) => patch("shop", event.target.value)}
                              />
                            </Field>
                            <Field label={<T k="admin.city" />}>
                              <Input
                                value={draft.city}
                                maxLength={64}
                                onChange={(event) => patch("city", event.target.value)}
                              />
                            </Field>
                            <Field label={<T k="admin.address" />}>
                              <Input
                                value={draft.address}
                                maxLength={160}
                                onChange={(event) => patch("address", event.target.value)}
                              />
                            </Field>
                            <Field label={<T k="common.phone" />}>
                              <Input
                                value={draft.phone}
                                maxLength={32}
                                onChange={(event) => patch("phone", event.target.value)}
                              />
                            </Field>
                            <Field label={<T k="admin.years" />}>
                              <Input
                                type="number"
                                min={0}
                                max={80}
                                value={draft.years}
                                onChange={(event) => patch("years", event.target.value)}
                              />
                            </Field>
                            <Field label={<T k="admin.photoUrl" />}>
                              <Input
                                value={draft.photo}
                                maxLength={512}
                                onChange={(event) => patch("photo", event.target.value)}
                              />
                            </Field>
                            <Field label={<T k="admin.skills" />}>
                              <Input
                                value={draft.skills}
                                maxLength={256}
                                onChange={(event) => patch("skills", event.target.value)}
                              />
                            </Field>
                            <Field label={<T k="admin.social" />}>
                              <Input
                                value={draft.social}
                                maxLength={256}
                                onChange={(event) => patch("social", event.target.value)}
                              />
                            </Field>
                            <Field label={<T k="admin.facilities" />}>
                              <Input
                                value={draft.facilities}
                                maxLength={256}
                                onChange={(event) => patch("facilities", event.target.value)}
                              />
                            </Field>
                            <Field label={<T k="admin.bookingPolicy" />} wide>
                              <Textarea
                                value={draft.policy}
                                maxLength={512}
                                onChange={(event) => patch("policy", event.target.value)}
                              />
                            </Field>
                            <div className="flex items-center gap-2 text-sm">
                              <Checkbox
                                id={`barber-confirm-${barber.id}`}
                                checked={draft.confirm}
                                onCheckedChange={(value) => patch("confirm", value)}
                              />
                              <Label htmlFor={`barber-confirm-${barber.id}`} className="cursor-pointer">
                                <T k="admin.requiresConfirmation" />
                              </Label>
                            </div>
                            <div className="flex gap-2 sm:col-span-2">
                              <Button type="submit" size="sm" disabled={update.isPending}>
                                {update.isPending ? (
                                  <Loader2 className="size-3 animate-spin" aria-hidden />
                                ) : null}
                                <T k="common.save" />
                              </Button>
                            </div>
                          </form>
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </Fragment>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Section>

      <Section title={<T k="admin.portfolio" />} description={<T k="admin.portfolioDesc" />}>
        {portfolio.isPending ? (
          <LoadingRows />
        ) : (portfolio.data ?? []).length === 0 ? (
          <Empty><T k="admin.noPortfolio" /></Empty>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead><T k="common.name" /></TableHead>
                  <TableHead><T k="admin.image" /></TableHead>
                  <TableHead><T k="common.note" /></TableHead>
                  <TableHead className="text-right"><T k="admin.actions" /></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(portfolio.data ?? []).map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{names.get(item.barber) ?? item.barber}</TableCell>
                    <TableCell className="max-w-72 truncate">
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary underline underline-offset-2"
                      >
                        {item.url}
                      </a>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{item.note || "—"}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        type="button"
                        size="xs"
                        variant="destructive"
                        disabled={removeImage.isPending}
                        onClick={() => {
                          if (!window.confirm(t("admin.confirmRemoveImage"))) return;
                          removeImage.mutate(item.id, {
                            onSuccess: () => toast.success(t("admin.removed")),
                            onError: (cause) =>
                              toast.error(message(cause, t("admin.saveError"))),
                          });
                        }}
                      >
                        <T k="common.remove" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Section>
    </div>
  );
}

function Field({ label, wide, children }: { label: ReactNode; wide?: boolean; children: ReactNode }) {
  return (
    <div className={`space-y-1.5 ${wide ? "sm:col-span-2" : ""}`}>
      <Label>{label}</Label>
      {children}
    </div>
  );
}
