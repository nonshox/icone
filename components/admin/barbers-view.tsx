"use client";

import { Loader2, Pencil } from "lucide-react";
import { Fragment, useState, type FormEvent } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  shop: string;
  city: string;
  address: string;
  phone: string;
  years: string;
  photo: string;
  policy: string;
  confirm: boolean;
  featured: boolean;
};

function draftFor(barber: AdminBarber): Draft {
  return {
    name: barber.name,
    title: barber.title,
    shop: barber.shop,
    city: barber.city,
    address: barber.address,
    phone: barber.phone,
    years: String(barber.years),
    photo: barber.photo,
    policy: barber.policy,
    confirm: barber.confirm,
    featured: barber.featured,
  };
}

export function BarbersView() {
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
    (list.error ? message(list.error, "Could not load barbers.") : null) ??
    (portfolio.error ? message(portfolio.error, "Could not load the portfolio.") : null) ??
    (removeImage.error ? message(removeImage.error, "Could not remove the image.") : null);

  function patch<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((current) => (current ? { ...current, [key]: value } : current));
  }

  function save(event: FormEvent<HTMLFormElement>, barber: AdminBarber) {
    event.preventDefault();
    if (!draft || !draft.name.trim()) {
      setErrorText("Give the barber a name.");
      return;
    }
    setErrorText(null);
    update.mutate(
      {
        id: barber.id,
        name: draft.name,
        title: draft.title,
        shop: draft.shop,
        city: draft.city,
        address: draft.address,
        phone: draft.phone,
        years: Number(draft.years) || 0,
        photo: draft.photo,
        policy: draft.policy,
        confirm: draft.confirm,
      },
      {
        onSuccess: () => {
          setEditingId(null);
          setDraft(null);
          toast.success("Barber updated");
        },
        onError: (cause) => {
          setErrorText(message(cause, "Could not save the barber."));
          toast.error("Could not save the barber");
        },
      },
    );
  }

  const barbers = list.data ?? [];
  const names = new Map(barbers.map((item) => [item.id, item.name]));

  return (
    <div className="space-y-6">
      <Section
        title="Chairs"
        description="Edit a chair, feature it on the homepage, or take it offline."
      >
        <FormError text={error} />

        {list.isPending ? (
          <LoadingRows />
        ) : barbers.length === 0 ? (
          <Empty>No barbers yet.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Barber</TableHead>
                  <TableHead>City</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Featured</TableHead>
                  <TableHead className="text-right">Action</TableHead>
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
                        <Badge variant={barber.active ? "secondary" : "outline"}>
                          {barber.active ? "Active" : "Offline"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={barber.featured ? "default" : "outline"}>
                          {barber.featured ? "Featured" : "Standard"}
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
                            {editingId === barber.id ? "Cancel" : <><Pencil className="size-3" aria-hidden /> Edit</>}
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
                                  onSuccess: () =>
                                    toast.success(
                                      barber.featured
                                        ? "Removed from featured"
                                        : "Added to featured",
                                    ),
                                  onError: (cause) =>
                                    toast.error("Could not update featured status", {
                                      description: message(cause, "Try again."),
                                    }),
                                },
                              )
                            }
                          >
                            {barber.featured ? "Unfeature" : "Feature"}
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
                                  onSuccess: () =>
                                    toast.success(
                                      barber.active
                                        ? "Chair taken offline"
                                        : "Chair is back online",
                                    ),
                                  onError: (cause) =>
                                    toast.error("Could not update the chair", {
                                      description: message(cause, "Try again."),
                                    }),
                                },
                              )
                            }
                          >
                            {active.isPending ? (
                              <Loader2 className="size-3 animate-spin" aria-hidden />
                            ) : null}
                            {barber.active ? "Suspend" : "Activate"}
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
                            <Field label="Name">
                              <Input
                                value={draft.name}
                                maxLength={64}
                                onChange={(event) => patch("name", event.target.value)}
                              />
                            </Field>
                            <Field label="Title">
                              <Input
                                value={draft.title}
                                maxLength={64}
                                onChange={(event) => patch("title", event.target.value)}
                              />
                            </Field>
                            <Field label="Shop">
                              <Input
                                value={draft.shop}
                                maxLength={64}
                                onChange={(event) => patch("shop", event.target.value)}
                              />
                            </Field>
                            <Field label="City">
                              <Input
                                value={draft.city}
                                maxLength={64}
                                onChange={(event) => patch("city", event.target.value)}
                              />
                            </Field>
                            <Field label="Address">
                              <Input
                                value={draft.address}
                                maxLength={128}
                                onChange={(event) => patch("address", event.target.value)}
                              />
                            </Field>
                            <Field label="Phone">
                              <Input
                                value={draft.phone}
                                maxLength={32}
                                onChange={(event) => patch("phone", event.target.value)}
                              />
                            </Field>
                            <Field label="Years on the floor">
                              <Input
                                type="number"
                                min={0}
                                max={80}
                                value={draft.years}
                                onChange={(event) => patch("years", event.target.value)}
                              />
                            </Field>
                            <Field label="Photo URL">
                              <Input
                                value={draft.photo}
                                maxLength={512}
                                onChange={(event) => patch("photo", event.target.value)}
                              />
                            </Field>
                            <Field label="Booking policy" wide>
                              <Textarea
                                value={draft.policy}
                                maxLength={512}
                                onChange={(event) => patch("policy", event.target.value)}
                              />
                            </Field>
                            <label className="flex items-center gap-2 text-sm">
                              <input
                                type="checkbox"
                                checked={draft.confirm}
                                onChange={(event) =>
                                  patch("confirm", event.target.checked)
                                }
                              />
                              Requires confirmation
                            </label>
                            <label className="flex items-center gap-2 text-sm">
                              <input
                                type="checkbox"
                                checked={draft.featured}
                                onChange={(event) =>
                                  patch("featured", event.target.checked)
                                }
                              />
                              Featured listing
                            </label>
                            <div className="flex gap-2 sm:col-span-2">
                              <Button type="submit" size="sm" disabled={update.isPending}>
                                {update.isPending ? (
                                  <Loader2 className="size-3 animate-spin" aria-hidden />
                                ) : null}
                                Save changes
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

      <Section
        title="Portfolio moderation"
        description="Submitted work. Remove anything that does not belong."
      >
        {portfolio.isPending ? (
          <LoadingRows />
        ) : (portfolio.data ?? []).length === 0 ? (
          <Empty>No portfolio images submitted yet.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Barber</TableHead>
                  <TableHead>Image</TableHead>
                  <TableHead>Note</TableHead>
                  <TableHead className="text-right">Action</TableHead>
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
                    <TableCell className="text-muted-foreground">
                      {item.note || "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        type="button"
                        size="xs"
                        variant="destructive"
                        disabled={removeImage.isPending}
                        onClick={() => {
                          if (!window.confirm("Remove this portfolio image?")) return;
                          removeImage.mutate(item.id, {
                            onSuccess: () => toast.success("Image removed"),
                            onError: (cause) =>
                              toast.error("Could not remove the image", {
                                description: message(cause, "Try again."),
                              }),
                          });
                        }}
                      >
                        Remove
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

function Field({
  label,
  wide,
  children,
}: {
  label: string;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={`space-y-1.5 ${wide ? "sm:col-span-2" : ""}`}>
      <Label>{label}</Label>
      {children}
    </div>
  );
}
