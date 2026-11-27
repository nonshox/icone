"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import {
  Empty,
  FormError,
  LoadingRows,
  message,
  ToggleRow,
} from "@/components/barber/barber-ui";
import { T } from "@/components/i18n/t";
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
import {
  useBranches,
  useCloseBranch,
  useCreateBranch,
  useTeam,
  useUpdateBranch,
  type Branch,
  type BranchCreate,
  type BranchPatch,
} from "@/lib/api/team-queries";
import { api } from "@/lib/api/client";
import { useT } from "@/lib/i18n/use-t";
import { label, parseTime } from "@/lib/domain/time";
import type { HourRow } from "@/lib/domain/types";

const BLANK = {
  name: "",
  phone: "",
  city: "",
  district: "",
  address: "",
  lat: "",
  lng: "",
  note: "",
  active: true,
  primary: false,
};

const selectClass =
  "h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring disabled:opacity-50";

type BranchHours = { branch: string; hours: Array<HourRow & { id: string }> };
type BranchWindow = { day: number; start: number; end: number };

function useBranchHours(business: string, branch: string) {
  return useQuery({
    queryKey: ["branch-hours", business, branch],
    queryFn: () => {
      const params = new URLSearchParams({ business, branch });
      return api<BranchHours>(`/api/barber/branches/hours?${params.toString()}`);
    },
    enabled: Boolean(business && branch),
  });
}

export function BranchManager({
  business,
  canManage,
}: {
  business: string;
  canManage: boolean;
}) {
  const t = useT();
  const branches = useBranches(business);
  const team = useTeam(business);
  const create = useCreateBranch();
  const update = useUpdateBranch();
  const close = useCloseBranch();

  const [form, setForm] = useState(BLANK);
  const [editing, setEditing] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const rows = branches.data ?? [];
  const [hoursBranch, setHoursBranch] = useState("");
  const activeHoursBranch = hoursBranch || rows[0]?.id || "";
  const hours = useBranchHours(business, activeHoursBranch);
  const [draft, setDraft] = useState<{
    branch: string;
    windows: BranchWindow[];
  } | null>(null);
  const serverWindows: BranchWindow[] = (hours.data?.hours ?? []).map(
    ({ day, start, end }) => ({ day, start, end }),
  );
  // A draft only applies to the branch it was edited for; switching branches
  // falls back to the server data without a synchronous effect.
  const windows =
    draft?.branch === activeHoursBranch ? draft.windows : serverWindows;
  const [hourDay, setHourDay] = useState("1");
  const [hourStart, setHourStart] = useState("10:00");
  const [hourEnd, setHourEnd] = useState("21:00");
  const [hoursError, setHoursError] = useState<string | null>(null);
  const client = useQueryClient();

  function updateWindows(update: (current: BranchWindow[]) => BranchWindow[]) {
    setDraft({
      branch: activeHoursBranch,
      windows: update(windows),
    });
  }

  const saveHours = useMutation({
    mutationFn: (next: BranchWindow[]) =>
      api<BranchHours>("/api/barber/branches/hours", {
        method: "POST",
        body: JSON.stringify({ business, branch: activeHoursBranch, windows: next }),
      }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ["branch-hours", business] });
      void client.invalidateQueries({ queryKey: ["agenda"] });
      void client.invalidateQueries({ queryKey: ["availability"] });
      void client.invalidateQueries({ queryKey: ["barbers"] });
      setDraft(null);
      setHoursError(null);
      toast.success(t("work.toast.saved"));
    },
    onError: (error) => {
      const text = message(error, t("work.toast.failed"));
      setHoursError(text);
      toast.error(text);
    },
  });

  const counts = new Map<string, number>();
  for (const member of team.data?.members ?? []) {
    if (member.branch && member.state === "active") {
      counts.set(member.branch, (counts.get(member.branch) ?? 0) + 1);
    }
  }

  function set<K extends keyof typeof BLANK>(key: K, value: (typeof BLANK)[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function reset() {
    setForm(BLANK);
    setEditing(null);
    setFormError(null);
  }

  function edit(branch: Branch) {
    setEditing(branch.id);
    setForm({
      name: branch.name,
      phone: branch.phone,
      city: branch.city,
      district: branch.district,
      address: branch.address,
      lat: branch.lat ? String(branch.lat) : "",
      lng: branch.lng ? String(branch.lng) : "",
      note: branch.note,
      active: branch.active,
      primary: branch.primary,
    });
    setFormError(null);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    if (!form.name.trim()) {
      setFormError(t("work.branches.nameRequired"));
      return;
    }

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
      const patch: BranchPatch = {
        id: editing,
        business,
        name: form.name.trim(),
        phone: form.phone.trim(),
        city: form.city.trim(),
        district: form.district.trim(),
        address: form.address.trim(),
        note: form.note.trim(),
        active: form.active,
        primary: form.primary,
      };
      const lat = Number(form.lat);
      const lng = Number(form.lng);
      if (form.lat.trim() && Number.isFinite(lat)) patch.lat = lat;
      if (form.lng.trim() && Number.isFinite(lng)) patch.lng = lng;
      update.mutate(patch, { onSuccess: done, onError: failed });
      return;
    }

    const input: BranchCreate = {
      business,
      name: form.name.trim(),
      city: form.city.trim() || undefined,
      primary: form.primary,
    };
    create.mutate(input, { onSuccess: done, onError: failed });
  }

  function closeBranch(branch: Branch) {
    if (!window.confirm(t("work.branches.closeAsk"))) return;
    close.mutate(
      { id: branch.id, business },
      {
        onSuccess: () => toast.success(t("work.toast.removed")),
        onError: (error) => toast.error(message(error, t("work.toast.failed"))),
      },
    );
  }

  const pending = create.isPending || update.isPending;

  return (
    <div className="space-y-6">
      {canManage ? (
        <Card className="glass">
          <CardHeader>
            <CardTitle>
              <T k={editing ? "work.branches.editTitle" : "work.branches.addTitle"} />
            </CardTitle>
            <CardDescription>
              <T k="work.branches.formHint" />
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="branch-name">
                  <T k="common.name" />
                </Label>
                <Input
                  id="branch-name"
                  value={form.name}
                  maxLength={64}
                  onChange={(event) => set("name", event.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="branch-city">
                  <T k="work.branches.city" />
                </Label>
                <Input
                  id="branch-city"
                  value={form.city}
                  maxLength={64}
                  onChange={(event) => set("city", event.target.value)}
                />
              </div>
              {editing ? (
                <>
                  <div className="space-y-1.5">
                    <Label htmlFor="branch-phone">
                      <T k="common.phone" />
                    </Label>
                    <Input
                      id="branch-phone"
                      type="tel"
                      value={form.phone}
                      maxLength={32}
                      onChange={(event) => set("phone", event.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="branch-district">
                      <T k="work.branches.district" />
                    </Label>
                    <Input
                      id="branch-district"
                      value={form.district}
                      maxLength={64}
                      onChange={(event) => set("district", event.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="branch-address">
                      <T k="work.branches.address" />
                    </Label>
                    <Input
                      id="branch-address"
                      value={form.address}
                      maxLength={160}
                      onChange={(event) => set("address", event.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="branch-lat">
                      <T k="work.branches.lat" />
                    </Label>
                    <Input
                      id="branch-lat"
                      type="number"
                      step="any"
                      value={form.lat}
                      onChange={(event) => set("lat", event.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="branch-lng">
                      <T k="work.branches.lng" />
                    </Label>
                    <Input
                      id="branch-lng"
                      type="number"
                      step="any"
                      value={form.lng}
                      onChange={(event) => set("lng", event.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="branch-note">
                      <T k="common.note" />
                    </Label>
                    <Textarea
                      id="branch-note"
                      value={form.note}
                      maxLength={256}
                      onChange={(event) => set("note", event.target.value)}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <ToggleRow
                      id="branch-active"
                      label={t("common.open")}
                      hint={t("work.branches.activeHint")}
                      checked={form.active}
                      onChange={(value) => set("active", value)}
                    />
                  </div>
                </>
              ) : null}
              <div className="sm:col-span-2">
                <ToggleRow
                  id="branch-primary"
                  label={t("work.branches.primary")}
                  hint={t("work.branches.primaryHint")}
                  checked={form.primary}
                  onChange={(value) => set("primary", value)}
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
                  <T k={editing ? "common.save" : "work.branches.addAction"} />
                </Button>
                {editing ? (
                  <Button type="button" variant="ghost" onClick={reset} disabled={pending}>
                    <T k="common.cancel" />
                  </Button>
                ) : null}
                <FormError text={formError} />
              </div>
            </form>
          </CardContent>
        </Card>
      ) : (
        <Card className="glass">
          <CardContent className="py-4 text-sm text-muted-foreground">
            <T k="work.branches.readOnly" />
          </CardContent>
        </Card>
      )}

      <Card className="glass">
        <CardHeader>
          <CardTitle>
            <T k="nav.branches" />
          </CardTitle>
          <CardDescription>
            <T k="work.branches.hint" />
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {branches.isPending ? (
            <LoadingRows />
          ) : branches.isError ? (
            <FormError text={message(branches.error, t("work.loadError"))} />
          ) : rows.length === 0 ? (
            <Empty>{t("work.branches.empty")}</Empty>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <T k="common.name" />
                  </TableHead>
                  <TableHead>
                    <T k="work.branches.address" />
                  </TableHead>
                  <TableHead>
                    <T k="common.phone" />
                  </TableHead>
                  <TableHead>
                    <T k="nav.team" />
                  </TableHead>
                  <TableHead>
                    <T k="common.status" />
                  </TableHead>
                  {canManage ? (
                    <TableHead className="text-right">
                      <T k="work.agenda.actions" />
                    </TableHead>
                  ) : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((branch) => (
                  <TableRow key={branch.id}>
                    <TableCell className="font-medium">
                      <span className="flex flex-wrap items-center gap-2">
                        {branch.name}
                        {branch.primary ? (
                          <Badge variant="secondary">
                            <T k="work.branches.primary" />
                          </Badge>
                        ) : null}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {[branch.address, branch.district, branch.city]
                        .filter(Boolean)
                        .join(", ") || "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {branch.phone || "—"}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {team.isPending ? "…" : team.isError ? "—" : (counts.get(branch.id) ?? 0)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={branch.active ? "secondary" : "outline"}>
                        <T k={branch.active ? "common.open" : "work.services.hidden"} />
                      </Badge>
                    </TableCell>
                    {canManage ? (
                      <TableCell className="text-right">
                        <div className="flex flex-wrap justify-end gap-1">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => edit(branch)}
                            disabled={pending}
                          >
                            <T k="common.edit" />
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="destructive"
                            onClick={() => closeBranch(branch)}
                            disabled={close.isPending || rows.length === 1}
                            title={rows.length === 1 ? t("work.branches.formHint") : undefined}
                            aria-label={`${t("work.branches.close")} ${branch.name}`}
                          >
                            <Trash2 aria-hidden />
                          </Button>
                        </div>
                      </TableCell>
                    ) : null}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {canManage ? (
        <Card className="glass">
          <CardHeader>
            <CardTitle>
              <T k="work.branches.hoursTitle" />
            </CardTitle>
            <CardDescription>
              <T k="work.branches.hoursHint" />
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="hours-branch" className="text-sm text-muted-foreground">
                <T k="work.branches.hoursPick" />
              </label>
              <select
                id="hours-branch"
                className={selectClass}
                value={activeHoursBranch}
                onChange={(event) => {
                  setHoursBranch(event.target.value);
                  setHoursError(null);
                }}
              >
                {rows.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </select>
            </div>

            {branches.isPending ? (
              <LoadingRows />
            ) : !activeHoursBranch ? (
              <p className="text-sm text-muted-foreground">
                <T k="work.branches.empty" />
              </p>
            ) : hours.isPending ? (
              <LoadingRows />
            ) : hours.isError ? (
              <FormError text={message(hours.error, t("work.branches.hoursLoadError"))} />
            ) : (
              <>
                {windows.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    <T k="work.branches.hoursEmpty" />
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {windows.map((window, index) => (
                      <li
                        key={`${window.day}-${window.start}-${index}`}
                        className="flex items-center justify-between gap-2 rounded-xl border border-border px-3 py-2 text-sm"
                      >
                        <span className="tabular-nums">
                          <T k={`day.${window.day}`} /> · {label(window.start)}–
                          {label(window.end)}
                        </span>
                        <Button
                          type="button"
                          size="icon-sm"
                          variant="ghost"
                          aria-label={`${t("common.remove")} ${t(`day.${window.day}`)}`}
                          disabled={saveHours.isPending}
                          onClick={() =>
                            updateWindows((current) =>
                              current.filter((_, position) => position !== index),
                            )
                          }
                        >
                          <Trash2 aria-hidden />
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}

                <form
                  className="grid gap-2 sm:grid-cols-4"
                  onSubmit={(event: FormEvent<HTMLFormElement>) => {
                    event.preventDefault();
                    const from = parseTime(hourStart);
                    const to = parseTime(hourEnd);
                    if (from === null || to === null || to <= from) {
                      setHoursError(t("work.staff.timeInvalid"));
                      return;
                    }
                    updateWindows((current) => [
                      ...current,
                      { day: Number(hourDay), start: from, end: to },
                    ]);
                    setHoursError(null);
                  }}
                >
                  <select
                    aria-label={t("work.staff.day")}
                    className={selectClass}
                    value={hourDay}
                    onChange={(event) => setHourDay(event.target.value)}
                  >
                    {Array.from({ length: 7 }, (_, index) => (
                      <option key={index} value={index}>
                        {t(`day.${index}`)}
                      </option>
                    ))}
                  </select>
                  <Input
                    aria-label={t("work.staff.opens")}
                    type="time"
                    value={hourStart}
                    onChange={(event) => setHourStart(event.target.value)}
                  />
                  <Input
                    aria-label={t("work.staff.closes")}
                    type="time"
                    value={hourEnd}
                    onChange={(event) => setHourEnd(event.target.value)}
                  />
                  <Button type="submit" variant="outline" size="sm">
                    <Plus className="size-4" aria-hidden />
                    <T k="work.branches.addWindow" />
                  </Button>
                </form>

                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    type="button"
                    disabled={saveHours.isPending || !activeHoursBranch}
                    onClick={() => saveHours.mutate(windows)}
                  >
                    <T k="common.save" />
                  </Button>
                  <FormError text={hoursError} />
                </div>
              </>
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
