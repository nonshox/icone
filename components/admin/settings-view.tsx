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
import {
  PAYMENT_METHODS,
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
    (categories.error ? message(categories.error, "Could not load categories.") : null) ??
    (barbers.error ? message(barbers.error, "Could not load chairs.") : null);

  function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim()) {
      setErrorText("Give the category a name.");
      return;
    }
    setErrorText(null);
    create.mutate(name, {
      onSuccess: () => {
        setName("");
        toast.success("Category added");
      },
      onError: (cause) => {
        setErrorText(message(cause, "Could not add the category."));
        toast.error("Could not add the category");
      },
    });
  }

  function save(category: Category) {
    if (!editName.trim()) {
      setErrorText("Give the category a name.");
      return;
    }
    setErrorText(null);
    rename.mutate(
      { id: category.id, name: editName },
      {
        onSuccess: () => {
          setEditingId(null);
          toast.success("Category renamed");
        },
        onError: (cause) => {
          setErrorText(message(cause, "Could not rename the category."));
          toast.error("Could not rename the category");
        },
      },
    );
  }

  return (
    <div className="space-y-6">
      <Section
        title="Service categories"
        description="Inactive categories are hidden."
      >
        <form onSubmit={add} className="mb-4 flex flex-wrap items-end gap-3">
          <div className="min-w-48 flex-1 space-y-1.5">
            <Label htmlFor="category-name">New category</Label>
            <Input
              id="category-name"
              value={name}
              maxLength={32}
              placeholder="Kids"
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <Button type="submit" disabled={create.isPending}>
            Add category
          </Button>
        </form>

        <FormError text={error} />

        {categories.isPending ? (
          <LoadingRows />
        ) : (categories.data ?? []).length === 0 ? (
          <Empty>No categories yet.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
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
                        {category.active ? "Active" : "Hidden"}
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
                            Save
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
                            Rename
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
                                onError: (cause) =>
                                  toast.error("Could not update the category", {
                                    description: message(cause, "Try again."),
                                  }),
                              },
                            )
                          }
                        >
                          {category.active ? "Hide" : "Show"}
                        </Button>
                        <Button
                          type="button"
                          size="xs"
                          variant="destructive"
                          disabled={remove.isPending}
                          onClick={() => {
                            if (!window.confirm(`Remove ${category.name}?`)) return;
                            remove.mutate(category.id, {
                              onError: (cause) =>
                                toast.error("Could not remove the category", {
                                  description: message(cause, "Try again."),
                                }),
                            });
                          }}
                        >
                            Remove
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
        <Section
          title="Featured listings"
          description="Promoted on the directory."
        >
          {barbers.isPending ? (
            <LoadingRows />
          ) : (barbers.data ?? []).length === 0 ? (
            <Empty>No chairs yet.</Empty>
          ) : (
            <ul className="divide-y">
              {(barbers.data ?? []).map((barber) => (
                <li
                  key={barber.id}
                  className="flex items-center justify-between gap-3 py-2"
                >
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
                    {barber.featured ? "Featured" : "Feature"}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section
          title="Payment methods"
          description="Ways to settle a visit."
        >
          <ul className="space-y-2">
            {PAYMENT_METHODS.map((method) => (
              <li key={method.id} className="text-sm">
                <span className="font-medium">{method.label}</span>
                <span className="block text-xs text-muted-foreground">
                  {method.note}
                </span>
              </li>
            ))}
          </ul>
        </Section>
      </div>

      <Section
        title="Booking policies"
        description="Per-chair cancellation policy."
      >
        {barbers.isPending ? (
          <LoadingRows />
        ) : (barbers.data ?? []).length === 0 ? (
          <Empty>No chairs yet.</Empty>
        ) : (
          <ul className="divide-y">
            {(barbers.data ?? []).map((barber) => (
              <li key={barber.id} className="py-2 text-sm">
                <span className="font-medium">{barber.name}</span>
                <p className="text-xs text-muted-foreground">
                  {barber.policy || "No policy set."}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Announcements">
        <p className="text-sm text-muted-foreground">
          <Link
            href="/admin/moderation"
            className="text-primary underline underline-offset-2"
          >
            Open the announcement composer →
          </Link>
        </p>
      </Section>
    </div>
  );
}
