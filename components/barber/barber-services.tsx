"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Pencil, Plus, Trash2, Users } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { ImageUpload } from "@/components/upload/image-upload";
import { T } from "@/components/i18n/t";
import { useT } from "@/lib/i18n/use-t";
import { Badge } from "@/components/ui/badge";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { formatPrice } from "@/lib/domain/time";
import { ApiError, api } from "@/lib/api/client";
import {
  useBarberServices,
  useCreateBarberService,
  useDeleteBarberService,
  useUpdateBarberService,
  type Service,
  type ServiceInput,
} from "@/lib/api/barber-queries";
import type { Membership, OfferedService } from "@/lib/domain/types";

import { Empty, FormError, LoadingRows, message, ToggleRow } from "./barber-ui";

const BLANK = {
  name: "",
  note: "",
  price: "",
  time: "45",
  buffer: "0",
  category: "Hair",
  active: true,
  image: "",
};

const selectClass =
  "h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring disabled:opacity-50";

type EmployeeMenu = {
  business: string;
  barber: string;
  assigned: Array<
    OfferedService & {
      assignment: string;
      overridePrice: number;
      overrideTime: number;
    }
  >;
  unassigned: Service[];
};

function useEmployees() {
  return useQuery({
    queryKey: ["employee-menu", "team"],
    queryFn: async (): Promise<Membership[]> => {
      try {
        const result = await api<{ members: Membership[] }>("/api/barber/team");
        return result.members.filter(
          (row) => row.barber && row.state === "active" && row.active,
        );
      } catch (error) {
        // Independent barbers have no team; an empty menu is the honest answer.
        if (error instanceof ApiError && error.status === 403) return [];
        throw error;
      }
    },
  });
}

function useEmployeeMenu(barber: string) {
  return useQuery({
    queryKey: ["employee-menu", "services", barber],
    queryFn: () =>
      api<EmployeeMenu>(
        `/api/barber/services/assign?barber=${encodeURIComponent(barber)}`,
      ),
    enabled: Boolean(barber),
  });
}

function useEmployeeMenuWrite<T>() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: T & { method: "POST" | "PATCH" | "DELETE" }) =>
      api<{ ok: true }>("/api/barber/services/assign", {
        method: input.method,
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ["employee-menu"] });
      void client.invalidateQueries({ queryKey: ["barber"] });
      void client.invalidateQueries({ queryKey: ["barbers"] });
      void client.invalidateQueries({ queryKey: ["services"] });
      void client.invalidateQueries({ queryKey: ["availability"] });
      void client.invalidateQueries({ queryKey: ["agenda"] });
    },
  });
}

export function BarberServices() {
  const services = useBarberServices();
  const create = useCreateBarberService();
  const update = useUpdateBarberService();
  const remove = useDeleteBarberService();
  const t = useT();

  const [form, setForm] = useState(BLANK);
  const [editing, setEditing] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  function set<K extends keyof typeof BLANK>(key: K, value: (typeof BLANK)[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function reset() {
    setForm(BLANK);
    setEditing(null);
    setFormError(null);
  }

  function edit(service: Service) {
    setEditing(service.id);
    setForm({
      name: service.name,
      note: service.note,
      price: String(service.price),
      time: String(service.time),
      buffer: String(service.buffer ?? 0),
      category: service.category,
      active: service.active,
      image: service.image,
    });
    setFormError(null);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    const price = Number(form.price);
    const time = Number(form.time);
    const buffer = Number(form.buffer);
    if (!form.name.trim()) {
      setFormError(t("work.services.nameRequired"));
      return;
    }
    if (!Number.isInteger(price) || price < 0) {
      setFormError(t("work.services.priceRequired"));
      return;
    }
    if (!Number.isInteger(time) || time < 5 || time > 240) {
      setFormError(t("work.services.durationInvalid"));
      return;
    }
    if (!Number.isInteger(buffer) || buffer < 0 || buffer > 120) {
      setFormError(t("work.services.bufferInvalid"));
      return;
    }

    const input: ServiceInput = {
      name: form.name.trim(),
      note: form.note.trim(),
      price,
      time,
      buffer,
      category: form.category.trim() || t("barber.hair"),
      active: form.active,
      image: form.image.trim(),
    };

    const done = () => {
      toast.success(t(editing ? "work.toast.updated" : "work.toast.added"));
      reset();
    };
    const failed = (error: unknown) => {
      const text = message(error, t("work.toast.failed"));
      setFormError(text);
      toast.error(text);
    };

    if (editing) {
      update.mutate({ ...input, id: editing }, { onSuccess: done, onError: failed });
    } else {
      create.mutate(input, { onSuccess: done, onError: failed });
    }
  }

  const pending = create.isPending || update.isPending;

  return (
    <div className="space-y-6">
      <Card className="glass">
        <CardHeader>
          <CardTitle>
            <T k={editing ? "work.services.editTitle" : "work.services.addTitle"} />
          </CardTitle>
          <CardDescription>
            <T k="work.services.hint" />
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="service-name">
                <T k="common.name" />
              </Label>
              <Input
                id="service-name"
                value={form.name}
                maxLength={64}
                onChange={(event) => set("name", event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="service-category">
                <T k="work.services.category" />
              </Label>
              <Input
                id="service-category"
                value={form.category}
                maxLength={32}
                onChange={(event) => set("category", event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="service-price">
                <T k="common.price" /> (UZS)
              </Label>
              <Input
                id="service-price"
                type="number"
                min={0}
                step={1}
                value={form.price}
                onChange={(event) => set("price", event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="service-time">
                <T k="work.services.duration" />
              </Label>
              <Input
                id="service-time"
                type="number"
                min={5}
                max={240}
                step={5}
                value={form.time}
                onChange={(event) => set("time", event.target.value)}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="service-buffer">
                <T k="work.services.buffer" />
              </Label>
              <Input
                id="service-buffer"
                type="number"
                min={0}
                max={120}
                step={5}
                value={form.buffer}
                onChange={(event) => set("buffer", event.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                <T k="work.services.bufferHint" />
              </p>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="service-note">
                <T k="common.note" />
              </Label>
              <Textarea
                id="service-note"
                value={form.note}
                maxLength={256}
                onChange={(event) => set("note", event.target.value)}
              />
            </div>
            <div className="sm:col-span-2">
              <ImageUpload
                id="service-image"
                folder="service"
                label={<T k="admin.image" />}
                value={form.image}
                onChange={(id) => set("image", id)}
              />
            </div>
            <div className="sm:col-span-2">
              <ToggleRow
                id="service-active"
                label={t("work.settings.active")}
                hint={t("work.services.activeHint")}
                checked={form.active}
                onChange={(value) => set("active", value)}
              />
            </div>
            <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
              <Button type="submit" disabled={pending} className="h-10">
                {pending ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : editing ? (
                  <Pencil className="size-4" aria-hidden />
                ) : (
                  <Plus className="size-4" aria-hidden />
                )}
                <T k={editing ? "common.save" : "work.services.addAction"} />
              </Button>
              {editing ? (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={reset}
                  disabled={pending}
                >
                  <T k="common.cancel" />
                </Button>
              ) : null}
              <FormError text={formError} />
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="glass">
        <CardHeader>
          <CardTitle>
            <T k="work.services.menu" />
          </CardTitle>
          <CardDescription>
            {services.data?.length ?? 0} <T k="barber.services" />
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {services.isPending ? (
            <LoadingRows />
          ) : services.isError ? (
            <FormError text={message(services.error, t("work.loadError"))} />
          ) : !services.data || services.data.length === 0 ? (
            <Empty>{t("work.services.empty")}</Empty>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <T k="common.name" />
                  </TableHead>
                  <TableHead>
                    <T k="work.services.category" />
                  </TableHead>
                  <TableHead className="text-right">
                    <T k="common.price" />
                  </TableHead>
                  <TableHead className="text-right">
                    <T k="common.time" />
                  </TableHead>
                  <TableHead>
                    <T k="common.status" />
                  </TableHead>
                  <TableHead className="text-right">
                    <T k="work.agenda.actions" />
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {services.data.map((service) => (
                  <TableRow key={service.id}>
                    <TableCell className="font-medium">{service.name}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {service.category}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatPrice(service.price)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {service.time} {t("common.minutes")}
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {service.active
                          ? t("common.open")
                          : t("work.services.hidden")}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          type="button"
                          size="icon-sm"
                          variant="ghost"
                          aria-label={`${t("common.edit")} ${service.name}`}
                          onClick={() => edit(service)}
                        >
                          <Pencil aria-hidden />
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={update.isPending}
                          onClick={() =>
                            update.mutate(
                              { id: service.id, active: !service.active },
                              {
                                onSuccess: () =>
                                  toast.success(t("work.toast.updated")),
                                onError: (error) =>
                                  toast.error(
                                    message(error, t("work.toast.failed")),
                                  ),
                              },
                            )
                          }
                        >
                          <T k={service.active ? "work.services.hide" : "work.services.show"} />
                        </Button>
                        <Button
                          type="button"
                          size="icon-sm"
                          variant="destructive"
                          aria-label={`${t("common.remove")} ${service.name}`}
                          disabled={remove.isPending}
                          onClick={() =>
                            remove.mutate(service.id, {
                              onSuccess: () =>
                                toast.success(t("work.toast.removed")),
                              onError: (error) =>
                                toast.error(
                                  message(error, t("work.toast.failed")),
                                ),
                            })
                          }
                        >
                          <Trash2 aria-hidden />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <EmployeeMenuPanel />
    </div>
  );
}

/* ----------------------------------------------------------- employee menu */

function EmployeeMenuPanel() {
  const t = useT();
  const employees = useEmployees();
  const [barber, setBarber] = useState("");
  const menu = useEmployeeMenu(barber);
  const write = useEmployeeMenuWrite<Record<string, unknown>>();
  const [editing, setEditing] = useState<string | null>(null);
  const [price, setPrice] = useState("");
  const [time, setTime] = useState("");

  const members = employees.data ?? [];
  const chosen = barber || (members.length === 1 ? members[0].barber : "");
  const active = chosen && members.some((row) => row.barber === chosen) ? chosen : "";

  function feedback(error: unknown) {
    toast.error(error instanceof Error ? error.message : t("work.toast.failed"));
  }

  function assign(service?: string) {
    write.mutate(
      {
        method: "POST",
        barber: active,
        ...(service ? { service } : { all: true }),
      },
      {
        onSuccess: () => {
          toast.success(
            t(service ? "work.toast.added" : "work.services.allAssigned"),
          );
        },
        onError: feedback,
      },
    );
  }

  function patch(input: {
    assignment: string;
    active?: boolean;
    price?: number;
    time?: number;
  }) {
    write.mutate(
      { method: "PATCH", barber: active, ...input },
      {
        onSuccess: () => {
          setEditing(null);
          toast.success(t("work.toast.updated"));
        },
        onError: feedback,
      },
    );
  }

  function unassign(assignment: string) {
    write.mutate(
      { method: "DELETE", barber: active, assignment },
      {
        onSuccess: () => toast.success(t("work.toast.removed")),
        onError: feedback,
      },
    );
  }

  function startEdit(row: EmployeeMenu["assigned"][number]) {
    setEditing(row.assignment);
    setPrice(String(row.overridePrice >= 0 ? row.overridePrice : row.price));
    setTime(String(row.overrideTime >= 0 ? row.overrideTime : row.time));
  }

  function saveEdit(row: EmployeeMenu["assigned"][number]) {
    const nextPrice = Number(price);
    const nextTime = Number(time);
    if (!Number.isInteger(nextPrice) || nextPrice < 0) {
      toast.error(t("work.services.priceRequired"));
      return;
    }
    if (!Number.isInteger(nextTime) || nextTime < 5 || nextTime > 480) {
      toast.error(t("work.services.durationInvalid"));
      return;
    }
    patch({ assignment: row.assignment, price: nextPrice, time: nextTime });
  }

  const assigned = menu.data?.assigned ?? [];
  const unassigned = menu.data?.unassigned ?? [];

  return (
    <Card className="glass">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="size-5 text-brand" aria-hidden />
          <T k="work.services.employeeMenu" />
        </CardTitle>
        <CardDescription>
          <T k="work.services.employeeMenuHint" />
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {employees.isPending ? (
          <LoadingRows />
        ) : employees.isError ? (
          <FormError text={message(employees.error, t("work.services.employeeLoadError"))} />
        ) : members.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            <T k="work.services.noEmployees" />
          </p>
        ) : (
          <>
            <div className="space-y-1.5">
              <label htmlFor="employee-menu-barber" className="text-sm text-muted-foreground">
                <T k="work.services.pickEmployee" />
              </label>
              <select
                id="employee-menu-barber"
                className={selectClass}
                value={active}
                onChange={(event) => {
                  setBarber(event.target.value);
                  setEditing(null);
                }}
              >
                <option value="">{t("walkin.choose")}</option>
                {members.map((member) => (
                  <option key={member.id} value={member.barber}>
                    {member.user ? member.user.slice(0, 8) : member.barber.slice(0, 8)}
                  </option>
                ))}
              </select>
            </div>

            {!active ? (
              <p className="text-sm text-muted-foreground">
                <T k="work.services.employeeRequired" />
              </p>
            ) : menu.isPending ? (
              <LoadingRows />
            ) : menu.isError ? (
              <FormError text={message(menu.error, t("work.services.menuLoadError"))} />
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium">
                    <T k="work.services.assigned" /> · {assigned.length}
                  </p>
                  {unassigned.length > 0 ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={write.isPending}
                      onClick={() => assign()}
                    >
                      <T k="work.services.assignAll" /> ({unassigned.length})
                    </Button>
                  ) : null}
                </div>

                {assigned.length === 0 ? (
                  <Empty>{t("work.services.empty")}</Empty>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead><T k="common.name" /></TableHead>
                          <TableHead className="text-right"><T k="common.price" /></TableHead>
                          <TableHead className="text-right"><T k="common.time" /></TableHead>
                          <TableHead><T k="common.status" /></TableHead>
                          <TableHead className="text-right"><T k="work.agenda.actions" /></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {assigned.map((row) => (
                          <TableRow key={row.id}>
                            <TableCell className="font-medium">{row.name}</TableCell>
                            <TableCell className="text-right tabular-nums">
                              {formatPrice(
                                row.overridePrice >= 0 ? row.overridePrice : row.price,
                              )}
                              {row.overridePrice < 0 ? (
                                <span className="block text-xs text-muted-foreground">
                                  <T k="work.services.inherit" />
                                </span>
                              ) : null}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {row.overrideTime >= 0 ? row.overrideTime : row.time}{" "}
                              {t("common.minutes")}
                            </TableCell>
                            <TableCell>
                              <Badge variant={row.active ? "secondary" : "outline"}>
                                <T k={row.active ? "common.open" : "work.services.hidden"} />
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex flex-wrap justify-end gap-1">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  disabled={write.isPending}
                                  onClick={() =>
                                    patch({ assignment: row.assignment, active: !row.active })
                                  }
                                >
                                  <T k={row.active ? "work.services.hide" : "work.services.show"} />
                                </Button>
                                <Button
                                  type="button"
                                  size="icon-sm"
                                  variant="ghost"
                                  aria-label={`${t("common.edit")} ${row.name}`}
                                  disabled={write.isPending}
                                  onClick={() => startEdit(row)}
                                >
                                  <Pencil aria-hidden />
                                </Button>
                                <Button
                                  type="button"
                                  size="icon-sm"
                                  variant="destructive"
                                  aria-label={`${t("work.services.unassign")} ${row.name}`}
                                  disabled={write.isPending || !row.assignment}
                                  onClick={() => unassign(row.assignment)}
                                >
                                  <Trash2 aria-hidden />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}

                {editing ? (
                  <div className="grid gap-3 rounded-xl border border-border p-3 sm:grid-cols-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="employee-price"><T k="common.price" /></Label>
                      <Input
                        id="employee-price"
                        type="number"
                        min={0}
                        step={1}
                        value={price}
                        onChange={(event) => setPrice(event.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="employee-time"><T k="work.services.duration" /></Label>
                      <Input
                        id="employee-time"
                        type="number"
                        min={5}
                        max={480}
                        step={5}
                        value={time}
                        onChange={(event) => setTime(event.target.value)}
                      />
                    </div>
                    <div className="flex items-end gap-2">
                      <Button
                        type="button"
                        disabled={write.isPending}
                        onClick={() => {
                          const row = assigned.find((item) => item.assignment === editing);
                          if (row) saveEdit(row);
                        }}
                      >
                        <T k="common.save" />
                      </Button>
                      <Button type="button" variant="ghost" onClick={() => setEditing(null)}>
                        <T k="common.cancel" />
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground sm:col-span-3">
                      <T k="work.services.overrideHint" />
                    </p>
                  </div>
                ) : null}

                <div className="space-y-2">
                  <p className="text-sm font-medium">
                    <T k="work.services.unassigned" /> · {unassigned.length}
                  </p>
                  {unassigned.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      <T k="work.services.allAssigned" />
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {unassigned.map((service) => (
                        <li
                          key={service.id}
                          className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border p-3"
                        >
                          <span className="text-sm">
                            {service.name} · {formatPrice(service.price)}
                          </span>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={write.isPending}
                            onClick={() => assign(service.id)}
                          >
                            <T k="work.services.assign" />
                          </Button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
