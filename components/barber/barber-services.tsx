"use client";

import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { ImageUpload } from "@/components/upload/image-upload";
import { T } from "@/components/i18n/t";
import { useT } from "@/lib/i18n/use-t";
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
import {
  useBarberServices,
  useCreateBarberService,
  useDeleteBarberService,
  useUpdateBarberService,
  type Service,
  type ServiceInput,
} from "@/lib/api/barber-queries";

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
    </div>
  );
}
