"use client";

import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

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
  image: "",
  category: "Hair",
  discount: "0",
  featured: false,
  active: true,
};

export function BarberServices() {
  const services = useBarberServices();
  const create = useCreateBarberService();
  const update = useUpdateBarberService();
  const remove = useDeleteBarberService();

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
      image: service.image,
      category: service.category,
      discount: String(service.discount),
      featured: service.featured,
      active: service.active,
    });
    setFormError(null);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    const price = Number(form.price);
    const time = Number(form.time);
    const discount = Number(form.discount);
    if (!form.name.trim()) {
      setFormError("Give the service a name.");
      return;
    }
    if (!Number.isInteger(price) || price < 0) {
      setFormError("Price must be a whole number of UZS.");
      return;
    }
    if (!Number.isInteger(time) || time < 5 || time > 240) {
      setFormError("Duration must be between 5 and 240 minutes.");
      return;
    }
    if (!Number.isInteger(discount) || discount < 0 || discount > 100) {
      setFormError("Discount must be between 0 and 100 percent.");
      return;
    }

    const input: ServiceInput = {
      name: form.name.trim(),
      note: form.note.trim(),
      price,
      time,
      image: form.image.trim(),
      category: form.category.trim() || "Hair",
      featured: form.featured,
      discount,
      active: form.active,
    };

    if (editing) {
      update.mutate(
        { ...input, id: editing },
        {
          onSuccess: () => {
            toast.success("Service updated");
            reset();
          },
          onError: (error) => {
            setFormError(message(error, "Could not update the service."));
            toast.error("Could not update the service");
          },
        },
      );
    } else {
      create.mutate(input, {
        onSuccess: () => {
          toast.success("Service added");
          reset();
        },
        onError: (error) => {
          setFormError(message(error, "Could not add the service."));
          toast.error("Could not add the service");
        },
      });
    }
  }

  const pending = create.isPending || update.isPending;

  return (
    <div className="space-y-6">
      <Card className="glass">
        <CardHeader>
          <CardTitle>{editing ? "Edit service" : "Add a service"}</CardTitle>
          <CardDescription>Active services appear in booking.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="service-name">Name</Label>
              <Input id="service-name" value={form.name} maxLength={64} onChange={(e) => set("name", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="service-category">Category</Label>
              <Input id="service-category" value={form.category} maxLength={32} onChange={(e) => set("category", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="service-price">Price (UZS)</Label>
              <Input id="service-price" type="number" min={0} step={1} value={form.price} onChange={(e) => set("price", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="service-time">Duration (minutes)</Label>
              <Input id="service-time" type="number" min={5} max={240} step={5} value={form.time} onChange={(e) => set("time", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="service-discount">Discount (%)</Label>
              <Input id="service-discount" type="number" min={0} max={100} step={1} value={form.discount} onChange={(e) => set("discount", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="service-image">Image link</Label>
              <Input id="service-image" type="url" value={form.image} maxLength={512} placeholder="https://…" onChange={(e) => set("image", e.target.value)} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="service-note">Note</Label>
              <Textarea id="service-note" value={form.note} maxLength={256} onChange={(e) => set("note", e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <ToggleRow id="service-featured" label="Featured" checked={form.featured} onChange={(v) => set("featured", v)} />
              <ToggleRow id="service-active" label="Active" hint="Visible to members." checked={form.active} onChange={(v) => set("active", v)} />
            </div>
            <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
              <Button type="submit" disabled={pending} className="h-10">
                {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : editing ? <Pencil className="size-4" aria-hidden /> : <Plus className="size-4" aria-hidden />}
                {editing ? "Save changes" : "Add service"}
              </Button>
              {editing ? (
                <Button type="button" variant="ghost" onClick={reset} disabled={pending}>
                  Cancel
                </Button>
              ) : null}
              <FormError text={formError} />
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="glass">
        <CardHeader>
          <CardTitle>Your menu</CardTitle>
          <CardDescription>{services.data?.length ?? 0} services.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {services.isPending ? (
            <LoadingRows />
          ) : services.isError ? (
            <FormError text={message(services.error, "Could not load your services.")} />
          ) : !services.data || services.data.length === 0 ? (
            <Empty>No services yet.</Empty>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Service</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                  <TableHead className="text-right">Time</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {services.data.map((service) => (
                  <TableRow key={service.id}>
                    <TableCell className="font-medium">{service.name}</TableCell>
                    <TableCell className="text-muted-foreground">{service.category}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatPrice(service.price)}</TableCell>
                    <TableCell className="text-right tabular-nums">{service.time} min</TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {service.active ? "Active" : "Hidden"}
                        {service.featured ? " · Featured" : ""}
                        {service.discount > 0 ? ` · ${service.discount}% off` : ""}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button type="button" size="icon-sm" variant="ghost" aria-label={`Edit ${service.name}`} onClick={() => edit(service)}>
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
                                onSuccess: () => toast.success(service.active ? "Service hidden" : "Service is live"),
                                onError: (error) => toast.error(message(error, "Could not change the status.")),
                              },
                            )
                          }
                        >
                          {service.active ? "Hide" : "Show"}
                        </Button>
                        <Button
                          type="button"
                          size="icon-sm"
                          variant="destructive"
                          aria-label={`Remove ${service.name}`}
                          disabled={remove.isPending}
                          onClick={() =>
                            remove.mutate(service.id, {
                              onSuccess: () => toast.success("Service removed"),
                              onError: (error) => toast.error(message(error, "Could not remove the service.")),
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
