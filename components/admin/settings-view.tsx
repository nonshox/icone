"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
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

import { Empty, FormError, LoadingRows, Section, message } from "./admin-ui";

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
