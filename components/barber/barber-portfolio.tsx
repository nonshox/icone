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
  useBarberPortfolio,
  useCreateBarberPortfolio,
  useDeleteBarberPortfolio,
  useUpdateBarberPortfolio,
  type PortfolioItem,
} from "@/lib/api/barber-queries";

import { Empty, FormError, LoadingRows, message } from "./barber-ui";

export function BarberPortfolio() {
  const portfolio = useBarberPortfolio();
  const create = useCreateBarberPortfolio();
  const update = useUpdateBarberPortfolio();
  const remove = useDeleteBarberPortfolio();

  const [url, setUrl] = useState("");
  const [note, setNote] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  function reset() {
    setUrl("");
    setNote("");
    setEditing(null);
    setFormError(null);
  }

  function edit(item: PortfolioItem) {
    setEditing(item.id);
    setUrl(item.url);
    setNote(item.note);
    setFormError(null);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    if (!url.trim()) {
      setFormError("Add an image link.");
      return;
    }

    const input = { url: url.trim(), note: note.trim() };
    if (editing) {
      update.mutate(
        { ...input, id: editing },
        {
          onSuccess: () => {
            toast.success("Photo updated");
            reset();
          },
          onError: (error) => {
            setFormError(message(error, "Could not update the photo."));
            toast.error("Could not update the photo");
          },
        },
      );
    } else {
      create.mutate(input, {
        onSuccess: () => {
          toast.success("Photo added");
          reset();
        },
        onError: (error) => {
          setFormError(message(error, "Could not add the photo."));
          toast.error("Could not add the photo");
        },
      });
    }
  }

  const pending = create.isPending || update.isPending;

  return (
    <div className="space-y-6">
      <Card className="glass">
        <CardHeader>
          <CardTitle>{editing ? "Edit photo" : "Add a photo"}</CardTitle>
          <CardDescription>Add a photo with a caption.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="portfolio-url">Image link</Label>
              <Input id="portfolio-url" type="url" value={url} maxLength={512} placeholder="https://…" onChange={(event) => setUrl(event.target.value)} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="portfolio-note">Caption</Label>
              <Input id="portfolio-note" value={note} maxLength={128} onChange={(event) => setNote(event.target.value)} />
            </div>
            <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
              <Button type="submit" disabled={pending} className="h-10">
                {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : editing ? <Pencil className="size-4" aria-hidden /> : <Plus className="size-4" aria-hidden />}
                {editing ? "Save changes" : "Add photo"}
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
          <CardTitle>Your work</CardTitle>
          <CardDescription>{portfolio.data?.length ?? 0} photos.</CardDescription>
        </CardHeader>
        <CardContent>
          {portfolio.isPending ? (
            <LoadingRows />
          ) : portfolio.isError ? (
            <FormError text={message(portfolio.error, "Could not load your portfolio.")} />
          ) : !portfolio.data || portfolio.data.length === 0 ? (
            <Empty>No photos yet.</Empty>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {portfolio.data.map((item) => (
                <div key={item.id} className="rounded-xl border border-border p-3">
                  <div
                    role="img"
                    aria-label={item.note || "Portfolio photo"}
                    className="h-36 w-full rounded-lg bg-cover bg-center bg-muted"
                    style={{ backgroundImage: `url("${item.url}")` }}
                  />
                  <p className="mt-3 truncate text-sm font-medium">{item.note || "Untitled"}</p>
                  <div className="mt-2 flex justify-end gap-1">
                    <Button type="button" size="icon-sm" variant="ghost" aria-label={`Edit ${item.note || "photo"}`} onClick={() => edit(item)}>
                      <Pencil aria-hidden />
                    </Button>
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="destructive"
                      aria-label={`Remove ${item.note || "photo"}`}
                      disabled={remove.isPending}
                      onClick={() =>
                        remove.mutate(item.id, {
                          onSuccess: () => toast.success("Photo removed"),
                          onError: (error) => toast.error(message(error, "Could not remove the photo.")),
                        })
                      }
                    >
                      <Trash2 aria-hidden />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
