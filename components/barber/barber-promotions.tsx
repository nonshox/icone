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
import { Textarea } from "@/components/ui/textarea";
import {
  useBarberPromotions,
  useCreateBarberPromotion,
  useDeleteBarberPromotion,
  useUpdateBarberPromotion,
  type Promotion,
  type PromotionInput,
} from "@/lib/api/barber-queries";
import { formatDate } from "@/lib/domain/time";

import { Empty, FormError, LoadingRows, message, ToggleRow } from "./barber-ui";

const BLANK = {
  name: "",
  kind: "percent" as PromotionInput["kind"],
  amount: "10",
  start: "",
  end: "",
  limit: "0",
  note: "",
  active: true,
};

export function BarberPromotions() {
  const promotions = useBarberPromotions();
  const create = useCreateBarberPromotion();
  const update = useUpdateBarberPromotion();
  const remove = useDeleteBarberPromotion();

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

  function edit(promotion: Promotion) {
    setEditing(promotion.id);
    setForm({
      name: promotion.name,
      kind: promotion.kind,
      amount: String(promotion.amount),
      start: promotion.start,
      end: promotion.end,
      limit: String(promotion.limit),
      note: promotion.note,
      active: promotion.active,
    });
    setFormError(null);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    const amount = Number(form.amount);
    const limit = Number(form.limit);
    if (!form.name.trim()) {
      setFormError("Give the offer a name.");
      return;
    }
    if (!Number.isInteger(amount) || amount < 0 || (form.kind === "percent" && amount > 100)) {
      setFormError(form.kind === "percent" ? "A percentage must be 0–100." : "Use a whole amount.");
      return;
    }
    if (!Number.isInteger(limit) || limit < 0) {
      setFormError("Usage limit cannot be negative.");
      return;
    }
    if (form.start && form.end && form.end < form.start) {
      setFormError("The end date must follow the start date.");
      return;
    }

    const input: PromotionInput = {
      name: form.name.trim(),
      kind: form.kind,
      amount,
      start: form.start,
      end: form.end,
      limit,
      note: form.note.trim(),
      active: form.active,
    };

    if (editing) {
      update.mutate(
        { ...input, id: editing },
        {
          onSuccess: () => {
            toast.success("Offer updated");
            reset();
          },
          onError: (error) => {
            setFormError(message(error, "Could not update the offer."));
            toast.error("Could not update the offer");
          },
        },
      );
    } else {
      create.mutate(input, {
        onSuccess: () => {
          toast.success("Offer added");
          reset();
        },
        onError: (error) => {
          setFormError(message(error, "Could not add the offer."));
          toast.error("Could not add the offer");
        },
      });
    }
  }

  const pending = create.isPending || update.isPending;

  return (
    <div className="space-y-6">
      <Card className="glass">
        <CardHeader>
          <CardTitle>{editing ? "Edit offer" : "Add an offer"}</CardTitle>
          <CardDescription>
            Active offers belong to your chair. Dates are optional.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="promo-name">Name</Label>
              <Input id="promo-name" value={form.name} maxLength={64} onChange={(e) => set("name", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="promo-kind">Kind</Label>
              <Select value={form.kind} onValueChange={(value) => set("kind", value as PromotionInput["kind"])}>
                <SelectTrigger id="promo-kind" className="h-9 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="percent">Percent off</SelectItem>
                  <SelectItem value="fixed">Fixed amount off</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="promo-amount">{form.kind === "percent" ? "Percent (%)" : "Amount (UZS)"}</Label>
              <Input id="promo-amount" type="number" min={0} step={1} value={form.amount} onChange={(e) => set("amount", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="promo-limit">Usage limit (0 = unlimited)</Label>
              <Input id="promo-limit" type="number" min={0} step={1} value={form.limit} onChange={(e) => set("limit", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="promo-start">Starts</Label>
              <Input id="promo-start" type="date" value={form.start} onChange={(e) => set("start", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="promo-end">Ends</Label>
              <Input id="promo-end" type="date" value={form.end} onChange={(e) => set("end", e.target.value)} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="promo-note">Note</Label>
              <Textarea id="promo-note" value={form.note} maxLength={256} onChange={(e) => set("note", e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <ToggleRow id="promo-active" label="Active" checked={form.active} onChange={(v) => set("active", v)} />
            </div>
            <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
              <Button type="submit" disabled={pending} className="h-10">
                {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : editing ? <Pencil className="size-4" aria-hidden /> : <Plus className="size-4" aria-hidden />}
                {editing ? "Save changes" : "Add offer"}
              </Button>
              {editing ? (
                <Button type="button" variant="ghost" onClick={reset} disabled={pending}>Cancel</Button>
              ) : null}
              <FormError text={formError} />
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="glass">
        <CardHeader>
          <CardTitle>Your offers</CardTitle>
          <CardDescription>{promotions.data?.length ?? 0} offers.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {promotions.isPending ? (
            <LoadingRows />
          ) : promotions.isError ? (
            <FormError text={message(promotions.error, "Could not load your offers.")} />
          ) : !promotions.data || promotions.data.length === 0 ? (
            <Empty>No offers yet.</Empty>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Offer</TableHead>
                  <TableHead>Discount</TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead>Uses</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {promotions.data.map((promotion) => (
                  <TableRow key={promotion.id}>
                    <TableCell className="font-medium">
                      {promotion.name}
                      <span className="block text-xs text-muted-foreground">{promotion.note || "—"}</span>
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {promotion.kind === "percent" ? `${promotion.amount}%` : `${promotion.amount} UZS`}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {promotion.start ? formatDate(promotion.start) : "Any"}
                      {promotion.end ? ` – ${formatDate(promotion.end)}` : ""}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {promotion.uses}/{promotion.limit || "∞"}
                    </TableCell>
                    <TableCell>{promotion.active ? "Active" : "Paused"}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button type="button" size="icon-sm" variant="ghost" aria-label={`Edit ${promotion.name}`} onClick={() => edit(promotion)}>
                          <Pencil aria-hidden />
                        </Button>
                        <Button
                          type="button"
                          size="icon-sm"
                          variant="destructive"
                          aria-label={`Remove ${promotion.name}`}
                          disabled={remove.isPending}
                          onClick={() =>
                            remove.mutate(promotion.id, {
                              onSuccess: () => toast.success("Offer removed"),
                              onError: (error) => toast.error(message(error, "Could not remove the offer.")),
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
