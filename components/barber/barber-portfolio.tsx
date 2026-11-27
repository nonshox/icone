"use client";

import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

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
  useBarberPortfolio,
  useCreateBarberPortfolio,
  useDeleteBarberPortfolio,
  useUpdateBarberPortfolio,
  type PortfolioInput,
  type PortfolioItem,
} from "@/lib/api/barber-queries";

import { Empty, FormError, LoadingRows, message, ToggleRow } from "./barber-ui";

const BLANK = {
  url: "",
  note: "",
  group: "",
  featured: false,
  public: true,
};

export function BarberPortfolio() {
  const portfolio = useBarberPortfolio();
  const create = useCreateBarberPortfolio();
  const update = useUpdateBarberPortfolio();
  const remove = useDeleteBarberPortfolio();
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

  function edit(item: PortfolioItem) {
    setEditing(item.id);
    setForm({
      url: item.url,
      note: item.note,
      group: item.group,
      featured: item.featured,
      public: item.public,
    });
    setFormError(null);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    if (!form.url.trim()) {
      setFormError(t("work.portfolio.urlRequired"));
      return;
    }

    const input: PortfolioInput = {
      url: form.url.trim(),
      note: form.note.trim(),
      group: form.group.trim(),
      featured: form.featured,
      public: form.public,
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
            <T k={editing ? "work.portfolio.editTitle" : "work.portfolio.addTitle"} />
          </CardTitle>
          <CardDescription>
            <T k="work.portfolio.hint" />
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="portfolio-url">
                <T k="work.portfolio.url" />
              </Label>
              <Input
                id="portfolio-url"
                type="url"
                value={form.url}
                maxLength={512}
                placeholder="https://…"
                onChange={(event) => set("url", event.target.value)}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="portfolio-note">
                <T k="common.note" />
              </Label>
              <Input
                id="portfolio-note"
                value={form.note}
                maxLength={128}
                onChange={(event) => set("note", event.target.value)}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="portfolio-group">
                <T k="work.portfolio.group" />
              </Label>
              <Input
                id="portfolio-group"
                value={form.group}
                maxLength={64}
                onChange={(event) => set("group", event.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                <T k="work.portfolio.groupHint" />
              </p>
            </div>
            <div className="sm:col-span-2">
              <ToggleRow
                id="portfolio-featured"
                label={t("work.portfolio.featured")}
                checked={form.featured}
                onChange={(value) => set("featured", value)}
              />
              <ToggleRow
                id="portfolio-public"
                label={t("work.portfolio.public")}
                checked={form.public}
                onChange={(value) => set("public", value)}
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
                <T k={editing ? "common.save" : "work.portfolio.addAction"} />
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
            <T k="work.portfolio.work" />
          </CardTitle>
          <CardDescription>
            {portfolio.data?.length ?? 0} <T k="barber.recentWork" />
          </CardDescription>
        </CardHeader>
        <CardContent>
          {portfolio.isPending ? (
            <LoadingRows />
          ) : portfolio.isError ? (
            <FormError text={message(portfolio.error, t("work.loadError"))} />
          ) : !portfolio.data || portfolio.data.length === 0 ? (
            <Empty>{t("work.portfolio.empty")}</Empty>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {portfolio.data.map((item) => (
                <div
                  key={item.id}
                  className="rounded-xl border border-border p-3"
                >
                  <div
                    role="img"
                    aria-label={item.note || t("work.portfolio.untitled")}
                    className="h-36 w-full rounded-lg bg-cover bg-center bg-muted"
                    style={{ backgroundImage: `url("${item.url}")` }}
                  />
                  <div className="mt-3 flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {item.note || t("work.portfolio.untitled")}
                      </p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {item.group ? (
                          <Badge variant="outline">{item.group}</Badge>
                        ) : null}
                        {!item.public ? (
                          <Badge variant="secondary">
                            <T k="work.portfolio.private" />
                          </Badge>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="ghost"
                        aria-label={`${t("common.edit")} ${item.note || t("work.portfolio.untitled")}`}
                        onClick={() => edit(item)}
                      >
                        <Pencil aria-hidden />
                      </Button>
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="destructive"
                        aria-label={`${t("common.remove")} ${item.note || t("work.portfolio.untitled")}`}
                        disabled={remove.isPending}
                        onClick={() =>
                          remove.mutate(item.id, {
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
