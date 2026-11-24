"use client";

import { CalendarDays, Loader2, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState, type FormEvent, type ReactNode } from "react";
import { toast } from "sonner";

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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
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
  useCreateMyHour,
  useDeleteMyDay,
  useDeleteMyHour,
  useMyChair,
  useMyUpcoming,
  useSaveMyDay,
  useUpdateMyChair,
  type Barber,
  type MyChairData,
  type StaffDay,
  type StaffHour,
} from "@/lib/api/staff-queries";
import { formatDate, formatPrice, label, parseTime } from "@/lib/domain/time";
import type { BookingRow, Status } from "@/lib/domain/types";

const TABS = [
  { id: "profile", label: "Profile" },
  { id: "hours", label: "Hours" },
  { id: "days", label: "Days" },
  { id: "upcoming", label: "Upcoming" },
] as const;

type Tab = (typeof TABS)[number]["id"];

const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

const statusVariant: Record<
  Status,
  "default" | "secondary" | "outline" | "destructive"
> = {
  pending: "outline",
  accepted: "secondary",
  booked: "default",
  done: "secondary",
  cancel: "outline",
  noshow: "destructive",
  rejected: "destructive",
};

type ChairState = {
  data: MyChairData | undefined;
  isPending: boolean;
  isError: boolean;
  errorMessage: string;
};

function message(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
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
      <Skeleton className="h-9 w-full" />
      <Skeleton className="h-9 w-full" />
      <Skeleton className="h-9 w-full" />
    </div>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return (
    <p className="py-8 text-center text-sm text-muted-foreground">{children}</p>
  );
}

export function StaffView() {
  const [tab, setTab] = useState<Tab>("profile");
  const chair = useMyChair();

  const state: ChairState = {
    data: chair.data,
    isPending: chair.isPending,
    isError: chair.isError,
    errorMessage: message(chair.error, "Could not load your chair."),
  };

  return (
    <div className="space-y-6">
      <nav aria-label="Chair sections" className="flex flex-wrap gap-2">
        <Link
          href="/barber"
          className="rounded-xl border border-brand/40 bg-brand/10 px-3 py-1.5 text-sm text-brand-strong transition-colors hover:bg-brand/15"
        >
          Business dashboard
        </Link>
        {TABS.map((item) => (
          <Button
            key={item.id}
            type="button"
            variant={tab === item.id ? "default" : "outline"}
            aria-pressed={tab === item.id}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </Button>
        ))}
      </nav>

      {tab === "profile" ? <ProfileSection state={state} /> : null}
      {tab === "hours" ? <HoursSection state={state} /> : null}
      {tab === "days" ? <DaysSection state={state} /> : null}
      {tab === "upcoming" ? <UpcomingSection /> : null}
    </div>
  );
}

/* ---------------------------------------------------------------- profile */

function ProfileSection({ state }: { state: ChairState }) {
  const chair = state.data?.chair;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Your chair</CardTitle>
        <CardDescription>Visible to members.</CardDescription>
      </CardHeader>
      <CardContent>
        {state.isPending ? (
          <LoadingRows />
        ) : state.isError ? (
          <FormError text={state.errorMessage} />
        ) : !chair ? (
          <Empty>No chair linked. Ask an admin to connect it.</Empty>
        ) : (
          <ProfileForm key={chair.id} chair={chair} />
        )}
      </CardContent>
    </Card>
  );
}

function ProfileForm({ chair }: { chair: Barber }) {
  const update = useUpdateMyChair();
  const [title, setTitle] = useState(chair.title);
  const [bio, setBio] = useState(chair.bio);
  const [photo, setPhoto] = useState(chair.photo);
  const [cover, setCover] = useState(chair.cover);
  const [shop, setShop] = useState(chair.shop);
  const [address, setAddress] = useState(chair.address);
  const [city, setCity] = useState(chair.city);
  const [years, setYears] = useState(String(chair.years));
  const [skills, setSkills] = useState(chair.skills);
  const [phone, setPhone] = useState(chair.phone);
  const [social, setSocial] = useState(chair.social);
  const [facilities, setFacilities] = useState(chair.facilities);
  const [policy, setPolicy] = useState(chair.policy);
  const [confirm, setConfirm] = useState(chair.confirm);
  const [featured, setFeatured] = useState(chair.featured);
  const [active, setActive] = useState(chair.active);
  const [formError, setFormError] = useState<string | null>(null);

  const error =
    formError ?? (update.error ? message(update.error, "Could not save your profile.") : null);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    const parsedYears = Number(years);
    if (!Number.isInteger(parsedYears) || parsedYears < 0 || parsedYears > 80) {
      setFormError("Years on the chair must be between 0 and 80.");
      return;
    }

    update.mutate(
      {
        title,
        bio,
        photo,
        cover,
        shop,
        address,
        city,
        years: parsedYears,
        skills,
        phone,
        social,
        facilities,
        policy,
        confirm,
        featured,
        active,
      },
      {
        onSuccess: () => toast.success("Chair profile saved"),
        onError: (cause) =>
          toast.error("Could not save your profile", {
            description: message(cause, "Please try again."),
          }),
      },
    );
  }

  return (
    <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
      <div className="space-y-1.5">
        <Label htmlFor="staff-title">Title</Label>
        <Input
          id="staff-title"
          value={title}
          maxLength={64}
          placeholder="Senior barber"
          onChange={(event) => setTitle(event.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="staff-photo">Photo link</Label>
        <Input
          id="staff-photo"
          type="url"
          value={photo}
          maxLength={512}
          placeholder="https://…"
          onChange={(event) => setPhoto(event.target.value)}
        />
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="staff-bio">Bio</Label>
        <Textarea
          id="staff-bio"
          value={bio}
          maxLength={512}
          placeholder="Short bio."
          onChange={(event) => setBio(event.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="staff-shop">Shop</Label>
        <Input id="staff-shop" value={shop} maxLength={64} onChange={(event) => setShop(event.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="staff-city">City</Label>
        <Input id="staff-city" value={city} maxLength={64} onChange={(event) => setCity(event.target.value)} />
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="staff-address">Address</Label>
        <Input id="staff-address" value={address} maxLength={128} onChange={(event) => setAddress(event.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="staff-years">Years on the chair</Label>
        <Input id="staff-years" type="number" min={0} max={80} value={years} onChange={(event) => setYears(event.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="staff-phone">Phone</Label>
        <Input id="staff-phone" value={phone} maxLength={32} onChange={(event) => setPhone(event.target.value)} />
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="staff-skills">Skills</Label>
        <Input id="staff-skills" value={skills} maxLength={512} onChange={(event) => setSkills(event.target.value)} />
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="staff-social">Social links</Label>
        <Input id="staff-social" value={social} maxLength={512} onChange={(event) => setSocial(event.target.value)} />
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="staff-facilities">Facilities</Label>
        <Input id="staff-facilities" value={facilities} maxLength={512} onChange={(event) => setFacilities(event.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="staff-cover">Cover link</Label>
        <Input id="staff-cover" type="url" value={cover} maxLength={512} onChange={(event) => setCover(event.target.value)} />
      </div>
      <div className="flex flex-wrap gap-4 self-end sm:col-span-1">
        <label htmlFor="staff-confirm" className="flex items-center gap-2 text-sm">
          <input id="staff-confirm" type="checkbox" checked={confirm} onChange={(event) => setConfirm(event.target.checked)} className="size-4 accent-[var(--brand)]" />
          Confirm bookings
        </label>
        <label htmlFor="staff-featured" className="flex items-center gap-2 text-sm">
          <input id="staff-featured" type="checkbox" checked={featured} onChange={(event) => setFeatured(event.target.checked)} className="size-4 accent-[var(--brand)]" />
          Featured
        </label>
        <label htmlFor="staff-active" className="flex items-center gap-2 text-sm">
          <input id="staff-active" type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} className="size-4 accent-[var(--brand)]" />
          Active
        </label>
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="staff-policy">Booking policy</Label>
        <Textarea id="staff-policy" value={policy} maxLength={512} onChange={(event) => setPolicy(event.target.value)} />
      </div>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <Button type="submit" className="h-10" disabled={update.isPending}>
          {update.isPending ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : null}
          Save profile
        </Button>
        <FormError text={error} />
      </div>
    </form>
  );
}

/* ------------------------------------------------------------------ hours */

function HoursSection({ state }: { state: ChairState }) {
  const create = useCreateMyHour();
  const remove = useDeleteMyHour();
  const [day, setDay] = useState("1");
  const [start, setStart] = useState("10:00");
  const [end, setEnd] = useState("21:00");
  const [formError, setFormError] = useState<string | null>(null);

  const error =
    formError ??
    (create.error ? message(create.error, "Could not add opening hours.") : null) ??
    (remove.error ? message(remove.error, "Could not remove opening hours.") : null);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    const from = parseTime(start);
    const to = parseTime(end);
    if (from === null || to === null || to <= from) {
      setFormError("Closing time must be after opening time.");
      return;
    }

    create.mutate(
      { day: Number(day), start: from, end: to },
      {
        onSuccess: () => {
          toast.success("Opening hours added");
          setFormError(null);
        },
        onError: (cause) =>
          toast.error("Could not add opening hours", {
            description: message(cause, "Please try again."),
          }),
      },
    );
  }

  function removeHour(hour: StaffHour) {
    remove.mutate(hour.id, {
      onSuccess: () => toast.success("Opening hours removed"),
      onError: (cause) =>
        toast.error("Could not remove opening hours", {
          description: message(cause, "Please try again."),
        }),
    });
  }

  const hours = state.data?.hours ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Weekly hours</CardTitle>
        <CardDescription>Add more than one window a day.</CardDescription>
      </CardHeader>
      <CardContent>
        {state.isPending ? (
          <LoadingRows />
        ) : state.isError ? (
          <FormError text={state.errorMessage} />
        ) : !state.data?.chair ? (
          <Empty>No chair is linked to your account yet.</Empty>
        ) : (
          <>
            <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="staff-hour-day">Day</Label>
                <Select value={day} onValueChange={(value) => setDay(String(value))}>
                  <SelectTrigger id="staff-hour-day" className="h-9 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {WEEKDAYS.map((name, index) => (
                      <SelectItem key={name} value={String(index)}>
                        {name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="hidden sm:block" aria-hidden />
              <div className="space-y-1.5">
                <Label htmlFor="staff-hour-start">Opens</Label>
                <Input
                  id="staff-hour-start"
                  type="time"
                  value={start}
                  onChange={(event) => setStart(event.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="staff-hour-end">Closes</Label>
                <Input
                  id="staff-hour-end"
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
                  Add hours
                </Button>
                <FormError text={error} />
              </div>
            </form>

            <Separator className="my-6" />

            {hours.length === 0 ? (
              <Empty>No weekly hours yet.</Empty>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Day</TableHead>
                    <TableHead>Hours</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {hours.map((hour) => (
                    <TableRow key={hour.id}>
                      <TableCell className="font-medium">
                        {WEEKDAYS[hour.day] ?? "—"}
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {label(hour.start)}–{label(hour.end)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          type="button"
                          size="icon-sm"
                          variant="destructive"
                          aria-label={`Remove ${WEEKDAYS[hour.day] ?? "weekly"} hours`}
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
  const [date, setDate] = useState("");
  const [openValue, setOpenValue] = useState("open");
  const [start, setStart] = useState("10:00");
  const [end, setEnd] = useState("21:00");
  const [note, setNote] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const open = openValue === "open";
  const error =
    formError ??
    (save.error ? message(save.error, "Could not save the override.") : null) ??
    (remove.error ? message(remove.error, "Could not remove the override.") : null);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    if (!date) {
      setFormError("Pick a date.");
      return;
    }

    let from = 0;
    let to = 0;
    if (open) {
      const parsedStart = parseTime(start);
      const parsedEnd = parseTime(end);
      if (parsedStart === null || parsedEnd === null || parsedEnd <= parsedStart) {
        setFormError("Closing time must be after opening time.");
        return;
      }
      from = parsedStart;
      to = parsedEnd;
    }

    save.mutate(
      { date, open, start: from, end: to, note },
      {
        onSuccess: () => {
          toast.success("Date override saved");
          setFormError(null);
        },
        onError: (cause) =>
          toast.error("Could not save the override", {
            description: message(cause, "Please try again."),
          }),
      },
    );
  }

  function removeOverride(day: StaffDay) {
    remove.mutate(day.id, {
      onSuccess: () => toast.success("Date override removed"),
      onError: (cause) =>
        toast.error("Could not remove the override", {
          description: message(cause, "Please try again."),
        }),
    });
  }

  const days = state.data?.days ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Date overrides</CardTitle>
        <CardDescription>Close a date or set special hours.</CardDescription>
      </CardHeader>
      <CardContent>
        {state.isPending ? (
          <LoadingRows />
        ) : state.isError ? (
          <FormError text={state.errorMessage} />
        ) : !state.data?.chair ? (
          <Empty>No chair is linked to your account yet.</Empty>
        ) : (
          <>
            <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="staff-day-date">Date</Label>
                <Input
                  id="staff-day-date"
                  type="date"
                  value={date}
                  onChange={(event) => setDate(event.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="staff-day-open">Shop</Label>
                <Select
                  value={openValue}
                  onValueChange={(value) => setOpenValue(String(value))}
                >
                  <SelectTrigger id="staff-day-open" className="h-9 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">Open</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="staff-day-start">Opens</Label>
                <Input
                  id="staff-day-start"
                  type="time"
                  value={start}
                  disabled={!open}
                  onChange={(event) => setStart(event.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="staff-day-end">Closes</Label>
                <Input
                  id="staff-day-end"
                  type="time"
                  value={end}
                  disabled={!open}
                  onChange={(event) => setEnd(event.target.value)}
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="staff-day-note">Note</Label>
                <Input
                  id="staff-day-note"
                  value={note}
                  maxLength={64}
                  placeholder="Holiday, early close…"
                  onChange={(event) => setNote(event.target.value)}
                />
              </div>
              <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
                <Button type="submit" className="h-10" disabled={save.isPending}>
                  {save.isPending ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                  ) : null}
                  Save override
                </Button>
                <FormError text={error} />
              </div>
            </form>

            <Separator className="my-6" />

            {days.length === 0 ? (
              <Empty>No date overrides yet.</Empty>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Hours</TableHead>
                    <TableHead>Note</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {days.map((day) => (
                    <TableRow key={day.id}>
                      <TableCell className="font-medium">
                        {formatDate(day.date)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={day.open ? "secondary" : "outline"}>
                          {day.open ? "Open" : "Closed"}
                        </Badge>
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {day.open ? `${label(day.start)}–${label(day.end)}` : "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {day.note || "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          type="button"
                          size="icon-sm"
                          variant="destructive"
                          aria-label={`Remove override for ${formatDate(day.date)}`}
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
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

/* --------------------------------------------------------------- upcoming */

function groupByDate(bookings: BookingRow[]): Array<[string, BookingRow[]]> {
  const groups = new Map<string, BookingRow[]>();
  for (const booking of bookings) {
    const rows = groups.get(booking.date) ?? [];
    rows.push(booking);
    groups.set(booking.date, rows);
  }
  return [...groups.entries()];
}

function UpcomingSection() {
  const upcoming = useMyUpcoming(14);
  const bookings = upcoming.data ?? [];
  const groups = groupByDate(bookings);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Upcoming</CardTitle>
        <CardDescription>Next 14 days.</CardDescription>
      </CardHeader>
      <CardContent>
        {upcoming.isPending ? (
          <LoadingRows />
        ) : upcoming.isError ? (
          <FormError
            text={message(upcoming.error, "Could not load the upcoming agenda.")}
          />
        ) : bookings.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <CalendarDays className="size-6 text-muted-foreground" aria-hidden />
            <Empty>Nothing booked in the next 14 days.</Empty>
          </div>
        ) : (
          <div className="space-y-6">
            {groups.map(([date, rows]) => (
              <div key={date} className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-medium">{formatDate(date)}</h3>
                  <Badge variant="outline">{rows.length} booked</Badge>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Time</TableHead>
                      <TableHead>Member</TableHead>
                      <TableHead>Service</TableHead>
                      <TableHead>Price</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((booking) => (
                      <TableRow key={booking.id}>
                        <TableCell className="font-medium tabular-nums">
                          {label(booking.start)}–{label(booking.end)}
                        </TableCell>
                        <TableCell>{booking.userName ?? "Member"}</TableCell>
                        <TableCell>{booking.serviceName}</TableCell>
                        <TableCell className="tabular-nums">
                          {formatPrice(booking.price)}
                        </TableCell>
                        <TableCell>
                          <Badge variant={statusVariant[booking.status]}>
                            <T k={`status.${booking.status}`} />
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
