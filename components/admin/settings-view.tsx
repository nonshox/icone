"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { T } from "@/components/i18n/t";
import { useT } from "@/lib/i18n/use-t";
import {
  useAdminBarbers,
  useAdminCategories,
  useCreateCategory,
  useDeleteCategory,
  useRenameCategory,
  useSetBarberFeatured,
  useSetCategoryActive,
  type Category,
} from "@/lib/api/admin-queries";
import {
  useAdminPlaces,
  useCreatePlace,
  useTogglePlace,
  type NewPlace,
} from "@/lib/api/platform-queries";

import { Empty, FormError, LoadingRows, Section, message } from "./admin-ui";

type PlaceDraft = {
  name: string;
  kind: "city" | "district";
  parent: string;
  ru: string;
  en: string;
  lat: string;
  lng: string;
};

const emptyDraft: PlaceDraft = {
  name: "",
  kind: "city",
  parent: "",
  ru: "",
  en: "",
  lat: "",
  lng: "",
};

function PlacesManager() {
  const t = useT();
  const places = useAdminPlaces();
  const create = useCreatePlace();
  const toggle = useTogglePlace();

  const [draft, setDraft] = useState<PlaceDraft>(emptyDraft);
  const [formError, setFormError] = useState<string | null>(null);

  const rows = places.data ?? [];
  const cities = rows.filter((place) => place.kind === "city");
  const busy = create.isPending || toggle.isPending;

  function patch<K extends keyof PlaceDraft>(key: K, value: PlaceDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft.name.trim()) {
      setFormError(t("padmin.places.nameRequired"));
      return;
    }

    const input: NewPlace = {
      name: draft.name,
      kind: draft.kind,
      ru: draft.ru,
      en: draft.en,
    };
    if (draft.kind === "district" && draft.parent) input.parent = draft.parent;
    if (draft.lat.trim()) input.lat = Number(draft.lat);
    if (draft.lng.trim()) input.lng = Number(draft.lng);

    if (
      (input.lat !== undefined && (!Number.isFinite(input.lat) || Math.abs(input.lat) > 90)) ||
      (input.lng !== undefined && (!Number.isFinite(input.lng) || Math.abs(input.lng) > 180))
    ) {
      setFormError(t("padmin.places.invalidCoords"));
      return;
    }

    setFormError(null);
    create.mutate(input, {
      onSuccess: () => {
        setDraft(emptyDraft);
        toast.success(t("padmin.places.created"));
      },
      onError: (cause) => {
        const text = message(cause, t("admin.saveError"));
        setFormError(text);
        toast.error(text);
      },
    });
  }

  return (
    <Section title={<T k="padmin.places.title" />} description={<T k="padmin.places.desc" />}>
      <form onSubmit={submit} className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="place-name"><T k="padmin.places.name" /></Label>
          <Input
            id="place-name"
            value={draft.name}
            maxLength={64}
            onChange={(event) => patch("name", event.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="place-kind"><T k="padmin.places.kind" /></Label>
          <Select
            value={draft.kind}
            onValueChange={(value) => patch("kind", value as "city" | "district")}
          >
            <SelectTrigger id="place-kind" className="h-9 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="city"><T k="padmin.places.city" /></SelectItem>
              <SelectItem value="district"><T k="padmin.places.district" /></SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="place-parent"><T k="padmin.places.parent" /></Label>
          <Select
            value={draft.parent || "none"}
            disabled={draft.kind !== "district"}
            onValueChange={(value) => patch("parent", value === "none" || !value ? "" : value)}
          >
            <SelectTrigger id="place-parent" className="h-9 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none"><T k="padmin.places.noParent" /></SelectItem>
              {cities.map((city) => (
                <SelectItem key={city.id} value={city.id}>{city.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="place-ru"><T k="padmin.places.ru" /></Label>
          <Input
            id="place-ru"
            value={draft.ru}
            maxLength={64}
            onChange={(event) => patch("ru", event.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="place-en"><T k="padmin.places.en" /></Label>
          <Input
            id="place-en"
            value={draft.en}
            maxLength={64}
            onChange={(event) => patch("en", event.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="place-lat"><T k="padmin.places.lat" /></Label>
          <Input
            id="place-lat"
            type="number"
            step="any"
            min={-90}
            max={90}
            value={draft.lat}
            onChange={(event) => patch("lat", event.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="place-lng"><T k="padmin.places.lng" /></Label>
          <Input
            id="place-lng"
            type="number"
            step="any"
            min={-180}
            max={180}
            value={draft.lng}
            onChange={(event) => patch("lng", event.target.value)}
          />
        </div>
        <div className="flex items-end">
          <Button type="submit" disabled={busy}>
            {create.isPending ? <T k="common.loading" /> : <T k="padmin.places.add" />}
          </Button>
        </div>
      </form>

      <FormError
        text={formError ?? (places.error ? message(places.error, t("admin.loadError")) : null)}
      />

      {places.isPending ? (
        <LoadingRows />
      ) : rows.length === 0 ? (
        <Empty><T k="padmin.places.empty" /></Empty>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead><T k="padmin.places.name" /></TableHead>
                <TableHead><T k="padmin.places.kind" /></TableHead>
                <TableHead><T k="padmin.places.parent" /></TableHead>
                <TableHead><T k="common.status" /></TableHead>
                <TableHead className="text-right"><T k="admin.actions" /></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((place) => {
                const parent = cities.find((city) => city.id === place.parent);
                return (
                  <TableRow key={place.id}>
                    <TableCell>
                      <p className="font-medium">{place.name}</p>
                      {(place.ru || place.en) ? (
                        <p className="text-xs text-muted-foreground">
                          {[place.ru, place.en].filter(Boolean).join(" · ")}
                        </p>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      {t(
                        place.kind === "city"
                          ? "padmin.places.city"
                          : "padmin.places.district",
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {parent?.name ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={place.active ? "secondary" : "outline"}>
                        {place.active ? t("admin.active") : t("admin.hidden")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        type="button"
                        size="xs"
                        variant="outline"
                        disabled={busy}
                        onClick={() => {
                          if (!place.active && !window.confirm(t("padmin.places.confirmShow"))) return;
                          toggle.mutate(
                            { id: place.id, active: !place.active },
                            {
                              onSuccess: () => toast.success(t("padmin.places.updated")),
                              onError: (cause) =>
                                toast.error(message(cause, t("admin.saveError"))),
                            },
                          );
                        }}
                      >
                        {place.active
                          ? t("padmin.places.hide")
                          : t("padmin.places.show")}
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </Section>
  );
}

export function SettingsView() {
  const t = useT();
  const categories = useAdminCategories();
  const barbers = useAdminBarbers();
  const create = useCreateCategory();
  const rename = useRenameCategory();
  const toggleActive = useSetCategoryActive();
  const remove = useDeleteCategory();
  const feature = useSetBarberFeatured();

  const [name, setName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [errorText, setErrorText] = useState<string | null>(null);

  const error =
    errorText ??
    (categories.error ? message(categories.error, t("admin.loadError")) : null) ??
    (barbers.error ? message(barbers.error, t("admin.loadError")) : null);

  function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim()) {
      setErrorText(t("admin.nameError"));
      return;
    }
    setErrorText(null);
    create.mutate(name, {
      onSuccess: () => {
        setName("");
        toast.success(t("admin.created"));
      },
      onError: (cause) => {
        const text = message(cause, t("admin.saveError"));
        setErrorText(text);
        toast.error(text);
      },
    });
  }

  function save(category: Category) {
    if (!editName.trim()) {
      setErrorText(t("admin.nameError"));
      return;
    }
    setErrorText(null);
    rename.mutate(
      { id: category.id, name: editName },
      {
        onSuccess: () => {
          setEditingId(null);
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

  return (
    <div className="space-y-6">
      <Section title={<T k="admin.categories" />} description={<T k="admin.categoriesDesc" />}>
        <form onSubmit={add} className="mb-4 flex flex-wrap items-end gap-3">
          <div className="min-w-48 flex-1 space-y-1.5">
            <Label htmlFor="category-name"><T k="admin.newCategory" /></Label>
            <Input
              id="category-name"
              value={name}
              maxLength={32}
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <Button type="submit" disabled={create.isPending}>
            <T k="admin.addCategory" />
          </Button>
        </form>

        <FormError text={error} />

        {categories.isPending ? (
          <LoadingRows />
        ) : (categories.data ?? []).length === 0 ? (
          <Empty><T k="admin.noCategories" /></Empty>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead><T k="common.name" /></TableHead>
                  <TableHead><T k="common.status" /></TableHead>
                  <TableHead className="text-right"><T k="admin.actions" /></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(categories.data ?? []).map((category) => (
                  <TableRow key={category.id}>
                    <TableCell>
                      {editingId === category.id ? (
                        <Input
                          value={editName}
                          maxLength={32}
                          onChange={(event) => setEditName(event.target.value)}
                        />
                      ) : (
                        <span className="font-medium">{category.name}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={category.active ? "secondary" : "outline"}>
                        {category.active ? t("admin.active") : t("admin.hidden")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex flex-wrap justify-end gap-2">
                        {editingId === category.id ? (
                          <Button
                            type="button"
                            size="xs"
                            variant="outline"
                            disabled={rename.isPending}
                            onClick={() => save(category)}
                          >
                            <T k="common.save" />
                          </Button>
                        ) : (
                          <Button
                            type="button"
                            size="xs"
                            variant="outline"
                            onClick={() => {
                              setEditingId(category.id);
                              setEditName(category.name);
                            }}
                          >
                            <T k="admin.rename" />
                          </Button>
                        )}
                        <Button
                          type="button"
                          size="xs"
                          variant="outline"
                          disabled={toggleActive.isPending}
                          onClick={() =>
                            toggleActive.mutate(
                              { id: category.id, active: !category.active },
                              {
                                onSuccess: () => toast.success(t("admin.saved")),
                                onError: (cause) =>
                                  toast.error(message(cause, t("admin.saveError"))),
                              },
                            )
                          }
                        >
                          {category.active ? <T k="admin.hide" /> : <T k="admin.show" />}
                        </Button>
                        <Button
                          type="button"
                          size="xs"
                          variant="destructive"
                          disabled={remove.isPending}
                          onClick={() => {
                            if (!window.confirm(t("admin.confirmRemoveCategory").replace("{name}", category.name))) return;
                            remove.mutate(category.id, {
                              onSuccess: () => toast.success(t("admin.removed")),
                              onError: (cause) =>
                                toast.error(message(cause, t("admin.saveError"))),
                            });
                          }}
                        >
                          <T k="common.remove" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Section>

      <PlacesManager />

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title={<T k="admin.featuredListings" />} description={<T k="admin.featuredDesc" />}>
          {barbers.isPending ? (
            <LoadingRows />
          ) : (barbers.data ?? []).length === 0 ? (
            <Empty><T k="admin.noBarbers" /></Empty>
          ) : (
            <ul className="divide-y">
              {(barbers.data ?? []).map((barber) => (
                <li key={barber.id} className="flex items-center justify-between gap-3 py-2">
                  <span className="truncate text-sm">{barber.name}</span>
                  <Button
                    type="button"
                    size="xs"
                    variant={barber.featured ? "secondary" : "outline"}
                    disabled={feature.isPending}
                    onClick={() =>
                      feature.mutate(
                        { id: barber.id, featured: !barber.featured },
                        {
                          onSuccess: () => toast.success(t("admin.saved")),
                          onError: (cause) =>
                            toast.error(message(cause, t("admin.saveError"))),
                        },
                      )
                    }
                  >
                    {barber.featured ? t("admin.featured") : t("admin.feature")}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title={<T k="admin.bookingPolicies" />}>
          {barbers.isPending ? (
            <LoadingRows />
          ) : (barbers.data ?? []).length === 0 ? (
            <Empty><T k="admin.noBarbers" /></Empty>
          ) : (
            <ul className="divide-y">
              {(barbers.data ?? []).map((barber) => (
                <li key={barber.id} className="py-2 text-sm">
                  <span className="font-medium">{barber.name}</span>
                  <p className="text-xs text-muted-foreground">
                    {barber.policy || t("admin.noPolicy")}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>

      <Section title={<T k="admin.notice" />}>
        <p className="text-sm text-muted-foreground">
          <Link
            href="/admin/moderation"
            className="text-primary underline underline-offset-2"
          >
            <T k="admin.noticeComposerLink" />
          </Link>
        </p>
      </Section>
    </div>
  );
}
