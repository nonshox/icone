"use client";

import { CalendarDays, Copy, Loader2, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ApiError } from "@/lib/api/client";
import {
  useCloneWeek,
  useCreateMyBreak,
  useCreateMyHour,
  useDeleteMyBreak,
  useDeleteMyDay,
  useDeleteMyHour,
  useMyChair,
  useSaveMyDay,
  type DayRow,
  type HourRow,
  type MyChairData,
  type StaffBreak,
} from "@/lib/api/staff-queries";
import { formatDate, label, parseTime } from "@/lib/domain/time";

const TABS = [
  { id: "hours", key: "work.staff.hours" },
  { id: "breaks", key: "work.staff.breaks" },
  { id: "days", key: "work.staff.days" },
] as const;

type Tab = (typeof TABS)[number]["id"];

type ChairState = {
  data: MyChairData | undefined;
  isPending: boolean;
  isError: boolean;
  errorMessage: string;
};

function message(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

/** Map the clone endpoint's stable codes to the visitor's language. */
function cloneMessage(error: unknown, t: (key: string) => string): string {
  if (error instanceof ApiError) {
    if (error.code === "no_workspace") return t("work.staff.cloneNoWorkspace");
    if (error.code === "rate_limited") return t("work.staff.cloneRateLimited");
  }
  return message(error, t("work.staff.cloneFailed"));
}

function FormError({ text }: { text: string | null }) {
  if (!text) return null;
  return (
    <p role="alert" aria-live="polite" className="text-sm text-destructive">
      {text}
    </p>
  );
}

function LoadingRows() {
  return (
    <div className="space-y-2 py-2" aria-hidden>
      <div className="h-9 w-full animate-pulse rounded-lg bg-muted" />
      <div className="h-9 w-full animate-pulse rounded-lg bg-muted" />
      <div className="h-9 w-full animate-pulse rounded-lg bg-muted" />
    </div>
  );
}

/** Small in-page confirmation; keeps the rest of the schedule screen intact. */
function CloneWeekDialog({
  open,
  busy,
  error,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  busy: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    confirmRef.current?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape" && !busy) onCancel();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, busy, onCancel]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="clone-week-title"
        aria-describedby="clone-week-desc"
        className="glass w-full max-w-sm space-y-4 rounded-2xl p-5 shadow-xl"
      >
        <div className="space-y-2">
          <h2 id="clone-week-title" className="text-lg font-semibold">
            <T k="work.staff.cloneTitle" />
          </h2>
          <p id="clone-week-desc" className="text-sm text-muted-foreground">
            <T k="work.staff.cloneHint" />
          </p>
          <p className="text-sm text-muted-foreground">
            <T k="work.staff.cloneBreaks" />
          </p>
          <FormError text={error} />
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={onCancel}
          >
            <T k="work.staff.cloneCancel" />
          </Button>
          <Button
            ref={confirmRef}
            type="button"
            disabled={busy}
            onClick={onConfirm}
          >
            {busy ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Copy className="size-4" aria-hidden />
            )}
            <T k="work.staff.cloneConfirm" />
          </Button>
        </div>
      </div>
    </div>
  );
}

export function StaffView() {
  const [tab, setTab] = useState<Tab>("hours");
  const chair = useMyChair();
  const t = useT();

  const state: ChairState = {
    data: chair.data,
    isPending: chair.isPending,
    isError: chair.isError,
    errorMessage: message(chair.error, t("work.loadError")),
  };

  return (
    <div className="space-y-6">
      <nav aria-label="Chair sections" className="flex flex-wrap gap-2">
        <Link
          href="/barber"
          className="rounded-xl border border-brand/40 bg-brand/10 px-3 py-1.5 text-sm text-brand-strong transition-colors hover:bg-brand/15"
        >
          <T k="work.staff.toDashboard" />
        </Link>
        <Link
          href="/barber/settings"
          className="rounded-xl border border-border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-brand/10 hover:text-foreground"
        >
          <T k="work.staff.settingsLink" />
        </Link>
        {TABS.map((item) => (
          <Button
            key={item.id}
            type="button"
            variant={tab === item.id ? "default" : "outline"}
            aria-pressed={tab === item.id}
            onClick={() => setTab(item.id)}
          >
            <T k={item.key} />
          </Button>
        ))}
      </nav>

      <Card className="glass">
        <CardHeader>
          <CardTitle>
            <T k="work.staff.chair" />
          </CardTitle>
          <CardDescription>
            <T k="work.staff.chairHint" />
          </CardDescription>
        </CardHeader>
        <CardContent>
          {state.isPending ? (
            <LoadingRows />
          ) : state.isError ? (
            <FormError text={state.errorMessage} />
          ) : !state.data?.barber ? (
            <p className="text-sm text-muted-foreground">
              <T k="work.staff.noChair" />
            </p>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{state.data.barber.name}</span>
              {state.data.barber.title ? (
                <span className="text-sm text-muted-foreground">
                  {state.data.barber.title}
                </span>
              ) : null}
              <Badge variant={state.data.barber.active ? "secondary" : "outline"}>
                <T k={state.data.barber.active ? "common.open" : "work.services.hidden"} />
              </Badge>
            </div>
          )}
        </CardContent>
      </Card>

      {tab === "hours" ? <HoursSection state={state} /> : null}
      {tab === "breaks" ? <BreaksSection state={state} /> : null}
      {tab === "days" ? <DaysSection state={state} /> : null}
    </div>
  );
}

/* ------------------------------------------------------------------ hours */

function HoursSection({ state }: { state: ChairState }) {
  const create = useCreateMyHour();
  const remove = useDeleteMyHour();
  const t = useT();
  const [day, setDay] = useState("1");
  const [start, setStart] = useState("10:00");
  const [end, setEnd] = useState("21:00");
  const [formError, setFormError] = useState<string | null>(null);
  const clone = useCloneWeek();
  const [cloneOpen, setCloneOpen] = useState(false);
  const [cloneError, setCloneError] = useState<string | null>(null);

  const error =
    formError ??
    (create.error ? message(create.error, t("work.toast.failed")) : null) ??
    (remove.error ? message(remove.error, t("work.toast.failed")) : null);

  function confirmClone() {
    setCloneError(null);
    clone.mutate(undefined, {
      onSuccess: () => {
        setCloneOpen(false);
        toast.success(t("work.staff.cloneSuccess"));
      },
      onError: (cause) => {
        const text = cloneMessage(cause, t);
        setCloneError(text);
        toast.error(text);
      },
    });
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    const from = parseTime(start);
    const to = parseTime(end);
    if (from === null || to === null || to <= from) {
      setFormError(t("work.staff.timeInvalid"));
      return;
    }

    create.mutate(
      { day: Number(day), start: from, end: to },
      {
        onSuccess: () => {
          toast.success(t("work.toast.added"));
          setFormError(null);
        },
        onError: (cause) =>
          toast.error(message(cause, t("work.toast.failed"))),
      },
    );
  }

  function removeHour(hour: HourRow) {
    remove.mutate(
      { day: hour.day, start: hour.start },
      {
        onSuccess: () => toast.success(t("work.toast.removed")),
        onError: (cause) =>
          toast.error(message(cause, t("work.toast.failed"))),
      },
    );
  }

  const hours = state.data?.hours ?? [];

  return (
    <>
      <Card className="glass">
        <CardHeader>
          <CardTitle>
            <T k="work.staff.weekly" />
          </CardTitle>
          <CardDescription>
            <T k="work.staff.weeklyHint" />
          </CardDescription>
        </CardHeader>
        <CardContent>
          {state.isPending ? (
            <LoadingRows />
          ) : state.isError ? (
            <FormError text={state.errorMessage} />
          ) : !state.data?.barber ? (
            <p className="text-sm text-muted-foreground">
              <T k="work.staff.noChair" />
            </p>
          ) : (
            <>
              <div className="flex justify-end pb-1">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setCloneError(null);
                    setCloneOpen(true);
                  }}
                >
                  <Copy className="size-4" aria-hidden />
                  <T k="work.staff.cloneWeek" />
                </Button>
              </div>
              <form onSubmit={submit} className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label htmlFor="staff-hour-day">
                    <T k="work.staff.day" />
                  </Label>
                  <Select value={day} onValueChange={(value) => setDay(String(value))}>
                    <SelectTrigger id="staff-hour-day" className="h-9 w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 7 }, (_, index) => (
                        <SelectItem key={index} value={String(index)}>
                          <T k={`day.${index}`} />
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="staff-hour-start">
                    <T k="work.staff.opens" />
                  </Label>
                  <Input
                    id="staff-hour-start"
                    type="time"
                    value={start}
                    onChange={(event) => setStart(event.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="staff-hour-end">
                    <T k="work.staff.closes" />
                  </Label>
                  <Input
                    id="staff-hour-end"
                    type="time"
                    value={end}
                    onChange={(event) => setEnd(event.target.value)}
                  />
                </div>
                <div className="flex flex-wrap items-center gap-3 sm:col-span-3">
                  <Button type="submit" className="h-10" disabled={create.isPending}>
                    {create.isPending ? (
                      <Loader2 className="size-4 animate-spin" aria-hidden />
                    ) : (
                      <Plus className="size-4" aria-hidden />
                    )}
                    <T k="work.staff.addHour" />
                  </Button>
                  <FormError text={error} />
                </div>
              </form>

              <Separator className="my-6" />

              {hours.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  <T k="work.staff.hoursEmpty" />
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>
                          <T k="work.staff.day" />
                        </TableHead>
                        <TableHead>
                          <T k="common.time" />
                        </TableHead>
                        <TableHead className="text-right">
                          <T k="work.agenda.actions" />
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {hours.map((hour) => (
                        <TableRow
                          key={`${hour.scope}-${hour.day}-${hour.start}`}
                        >
                          <TableCell className="font-medium">
                            <T k={`day.${hour.day}`} />
                          </TableCell>
                          <TableCell className="tabular-nums">
                            {label(hour.start)}–{label(hour.end)}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              type="button"
                              size="icon-sm"
                              variant="destructive"
                              aria-label={`${t("common.remove")} ${t(`day.${hour.day}`)}`}
                              disabled={remove.isPending}
                              onClick={() => removeHour(hour)}
                            >
                              <Trash2 aria-hidden />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
      <CloneWeekDialog
        open={cloneOpen}
        busy={clone.isPending}
        error={cloneError}
        onCancel={() => setCloneOpen(false)}
        onConfirm={confirmClone}
      />
    </>
  );
}

/* ----------------------------------------------------------------- breaks */

function BreaksSection({ state }: { state: ChairState }) {
  const create = useCreateMyBreak();
  const remove = useDeleteMyBreak();
  const t = useT();
  const [day, setDay] = useState("1");
  const [start, setStart] = useState("13:00");
  const [end, setEnd] = useState("14:00");
  const [note, setNote] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const error =
    formError ??
    (create.error ? message(create.error, t("work.toast.failed")) : null) ??
    (remove.error ? message(remove.error, t("work.toast.failed")) : null);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    const from = parseTime(start);
    const to = parseTime(end);
    if (from === null || to === null || to <= from) {
      setFormError(t("work.staff.timeInvalid"));
      return;
    }

    create.mutate(
      { day: Number(day), start: from, end: to, note: note.trim() },
      {
        onSuccess: () => {
          toast.success(t("work.toast.added"));
          setNote("");
          setFormError(null);
        },
        onError: (cause) =>
          toast.error(message(cause, t("work.toast.failed"))),
      },
    );
  }

  function removeBreakItem(item: StaffBreak) {
    if (!item.id) return;
    remove.mutate(item.id, {
      onSuccess: () => toast.success(t("work.toast.removed")),
      onError: (cause) => toast.error(message(cause, t("work.toast.failed"))),
    });
  }

  const breaks = state.data?.breaks ?? [];

  return (
    <Card className="glass">
      <CardHeader>
        <CardTitle>
          <T k="work.staff.breaks" />
        </CardTitle>
        <CardDescription>
          <T k="work.staff.breaksHint" />
        </CardDescription>
      </CardHeader>
      <CardContent>
        {state.isPending ? (
          <LoadingRows />
        ) : state.isError ? (
          <FormError text={state.errorMessage} />
        ) : !state.data?.barber ? (
          <p className="text-sm text-muted-foreground">
            <T k="work.staff.noChair" />
          </p>
        ) : (
          <>
            <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="staff-break-day">
                  <T k="work.staff.day" />
                </Label>
                <Select value={day} onValueChange={(value) => setDay(String(value))}>
                  <SelectTrigger id="staff-break-day" className="h-9 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 7 }, (_, index) => (
                      <SelectItem key={index} value={String(index)}>
                        <T k={`day.${index}`} />
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="staff-break-note">
                  <T k="common.note" />
                </Label>
                <Input
                  id="staff-break-note"
                  value={note}
                  maxLength={64}
                  placeholder={t("work.staff.noteHint")}
                  onChange={(event) => setNote(event.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="staff-break-start">
                  <T k="work.staff.opens" />
                </Label>
                <Input
                  id="staff-break-start"
                  type="time"
                  value={start}
                  onChange={(event) => setStart(event.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="staff-break-end">
                  <T k="work.staff.closes" />
                </Label>
                <Input
                  id="staff-break-end"
                  type="time"
                  value={end}
                  onChange={(event) => setEnd(event.target.value)}
                />
              </div>
              <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
                <Button type="submit" className="h-10" disabled={create.isPending}>
                  {create.isPending ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                  ) : (
                    <Plus className="size-4" aria-hidden />
                  )}
                  <T k="work.staff.addBreak" />
                </Button>
                <FormError text={error} />
              </div>
            </form>

            <Separator className="my-6" />

            {breaks.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                <T k="work.staff.breaksEmpty" />
              </p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>
                        <T k="work.staff.day" />
                      </TableHead>
                      <TableHead>
                        <T k="common.time" />
                      </TableHead>
                      <TableHead>
                        <T k="common.note" />
                      </TableHead>
                      <TableHead className="text-right">
                        <T k="work.agenda.actions" />
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {breaks.map((item) => (
                      <TableRow key={`${item.scope}-${item.day}-${item.start}-${item.end}`}>
                        <TableCell className="font-medium">
                          <T k={`day.${item.day}`} />
                        </TableCell>
                        <TableCell className="tabular-nums">
                          {label(item.start)}–{label(item.end)}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {item.note || "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            type="button"
                            size="icon-sm"
                            variant="destructive"
                            aria-label={`${t("common.remove")} ${t(`day.${item.day}`)}`}
                            disabled={remove.isPending || !item.id}
                            onClick={() => removeBreakItem(item)}
                          >
                            <Trash2 aria-hidden />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------- days */

function DaysSection({ state }: { state: ChairState }) {
  const save = useSaveMyDay();
  const remove = useDeleteMyDay();
  const t = useT();
  const [date, setDate] = useState("");
  const [openValue, setOpenValue] = useState("open");
  const [start, setStart] = useState("10:00");
  const [end, setEnd] = useState("21:00");
  const [note, setNote] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const open = openValue === "open";
  const error =
    formError ??
    (save.error ? message(save.error, t("work.toast.failed")) : null) ??
    (remove.error ? message(remove.error, t("work.toast.failed")) : null);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    if (!date) {
      setFormError(t("work.staff.dateRequired"));
      return;
    }

    let from = 0;
    let to = 0;
    if (open) {
      const parsedStart = parseTime(start);
      const parsedEnd = parseTime(end);
      if (parsedStart === null || parsedEnd === null || parsedEnd <= parsedStart) {
        setFormError(t("work.staff.timeInvalid"));
        return;
      }
      from = parsedStart;
      to = parsedEnd;
    }

    save.mutate(
      { date, open, start: from, end: to, note },
      {
        onSuccess: () => {
          toast.success(t("work.toast.saved"));
          setFormError(null);
        },
        onError: (cause) =>
          toast.error(message(cause, t("work.toast.failed"))),
      },
    );
  }

  function removeOverride(day: DayRow) {
    remove.mutate(day.date, {
      onSuccess: () => toast.success(t("work.toast.removed")),
      onError: (cause) =>
        toast.error(message(cause, t("work.toast.failed"))),
    });
  }

  const days = state.data?.days ?? [];

  return (
    <Card className="glass">
      <CardHeader>
        <CardTitle>
          <T k="work.staff.overrides" />
        </CardTitle>
        <CardDescription>
          <T k="work.staff.overridesHint" />
        </CardDescription>
      </CardHeader>
      <CardContent>
        {state.isPending ? (
          <LoadingRows />
        ) : state.isError ? (
          <FormError text={state.errorMessage} />
        ) : !state.data?.barber ? (
          <p className="text-sm text-muted-foreground">
            <T k="work.staff.noChair" />
          </p>
        ) : (
          <>
            <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="staff-day-date">
                  <T k="common.date" />
                </Label>
                <Input
                  id="staff-day-date"
                  type="date"
                  value={date}
                  onChange={(event) => setDate(event.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="staff-day-open">
                  <T k="common.status" />
                </Label>
                <Select
                  value={openValue}
                  onValueChange={(value) => setOpenValue(String(value))}
                >
                  <SelectTrigger id="staff-day-open" className="h-9 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">
                      <T k="common.open" />
                    </SelectItem>
                    <SelectItem value="closed">
                      <T k="work.staff.closed" />
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="staff-day-start">
                  <T k="work.staff.opens" />
                </Label>
                <Input
                  id="staff-day-start"
                  type="time"
                  value={start}
                  disabled={!open}
                  onChange={(event) => setStart(event.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="staff-day-end">
                  <T k="work.staff.closes" />
                </Label>
                <Input
                  id="staff-day-end"
                  type="time"
                  value={end}
                  disabled={!open}
                  onChange={(event) => setEnd(event.target.value)}
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="staff-day-note">
                  <T k="common.note" />
                </Label>
                <Input
                  id="staff-day-note"
                  value={note}
                  maxLength={64}
                  placeholder={t("work.staff.noteHint")}
                  onChange={(event) => setNote(event.target.value)}
                />
              </div>
              <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
                <Button type="submit" className="h-10" disabled={save.isPending}>
                  {save.isPending ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                  ) : (
                    <CalendarDays className="size-4" aria-hidden />
                  )}
                  <T k="work.staff.saveDay" />
                </Button>
                <FormError text={error} />
              </div>
            </form>

            <Separator className="my-6" />

            {days.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                <T k="work.staff.daysEmpty" />
              </p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>
                        <T k="common.date" />
                      </TableHead>
                      <TableHead>
                        <T k="common.status" />
                      </TableHead>
                      <TableHead>
                        <T k="common.time" />
                      </TableHead>
                      <TableHead>
                        <T k="common.note" />
                      </TableHead>
                      <TableHead className="text-right">
                        <T k="work.agenda.actions" />
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {days.map((day) => (
                      <TableRow key={`${day.scope}-${day.date}`}>
                        <TableCell className="font-medium">
                          {formatDate(day.date)}
                        </TableCell>
                        <TableCell>
                          <Badge variant={day.open ? "secondary" : "outline"}>
                            <T k={day.open ? "common.open" : "work.staff.closed"} />
                          </Badge>
                        </TableCell>
                        <TableCell className="tabular-nums">
                          {day.open
                            ? `${label(day.start)}–${label(day.end)}`
                            : "—"}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {day.note || "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            type="button"
                            size="icon-sm"
                            variant="destructive"
                            aria-label={`${t("common.remove")} ${formatDate(day.date)}`}
                            disabled={remove.isPending}
                            onClick={() => removeOverride(day)}
                          >
                            <Trash2 aria-hidden />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
