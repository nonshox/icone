"use client";

import { Loader2, Plus, Trash2 } from "lucide-react";
import { useState, type FormEvent, type ReactNode } from "react";
import { toast } from "sonner";

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
  useAdminBarbers,
  useAdminDays,
  useAdminHours,
  useAdminReviews,
  useAdminServices,
  useCreateBarber,
  useCreateHour,
  useCreateService,
  useDeleteDay,
  useDeleteHour,
  useDeleteReview,
  useSaveDay,
  useSetBarberActive,
  useSetServiceActive,
  type AdminBarber,
  type DayOverride,
  type Hour,
  type Service,
} from "@/lib/api/admin-queries";
import { formatDate, formatPrice, label, parseTime } from "@/lib/domain/time";

const TABS = [
  { id: "barbers", label: "Barbers" },
  { id: "services", label: "Services" },
  { id: "hours", label: "Hours" },
  { id: "days", label: "Days" },
  { id: "reviews", label: "Reviews" },
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

export function AdminView() {
  const [tab, setTab] = useState<Tab>("barbers");

  return (
    <div className="space-y-6">
      <nav aria-label="Catalogue sections" className="flex flex-wrap gap-2">
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

      {tab === "barbers" ? <BarbersSection /> : null}
      {tab === "services" ? <ServicesSection /> : null}
      {tab === "hours" ? <HoursSection /> : null}
      {tab === "days" ? <DaysSection /> : null}
      {tab === "reviews" ? <ReviewsSection /> : null}
    </div>
  );
}

/* ---------------------------------------------------------------- reviews */

function ReviewsSection() {
  const list = useAdminReviews();
  const remove = useDeleteReview();
  const [errorText, setErrorText] = useState<string | null>(null);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Reviews</CardTitle>
        <CardDescription>Remove anything that does not belong.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <FormError text={errorText} />
        {list.isPending ? (
          <LoadingRows />
        ) : list.isError ? (
          <FormError text="Could not load reviews." />
        ) : (list.data ?? []).length === 0 ? (
          <Empty>No reviews yet.</Empty>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Member</TableHead>
                <TableHead>Rating</TableHead>
                <TableHead>Note</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(list.data ?? []).map((review) => (
                <TableRow key={review.id}>
                  <TableCell className="font-mono text-xs">
                    {review.user.slice(0, 12)}
                  </TableCell>
                  <TableCell>{review.rate} / 5</TableCell>
                  <TableCell className="max-w-64 whitespace-normal">
                    {review.note || "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      type="button"
                      size="xs"
                      variant="destructive"
                      disabled={remove.isPending}
                      onClick={() => {
                        if (!window.confirm("Remove this review?")) return;
                        remove.mutate(review.id, {
                          onSuccess: () => setErrorText(null),
                          onError: (error) =>
                            setErrorText(message(error, "Could not remove the review.")),
                        });
                      }}
                    >
                      <Trash2 className="size-3" aria-hidden />
                      Remove
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

/* ---------------------------------------------------------------- barbers */

function BarbersSection() {
  const list = useAdminBarbers();
  const create = useCreateBarber();
  const toggle = useSetBarberActive();
  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [bio, setBio] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const error =
    formError ??
    (create.error ? message(create.error, "Could not add the barber.") : null) ??
    (toggle.error ? message(toggle.error, "Could not update the barber.") : null);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    if (!name.trim()) {
      setFormError("Give the barber a name.");
      return;
    }

    create.mutate(
      { name, title, bio },
      {
        onSuccess: () => {
          setName("");
          setTitle("");
          setBio("");
          toast.success("Barber added");
        },
        onError: (cause) =>
          toast.error("Could not add the barber", {
            description: message(cause, "Please try again."),
          }),
      },
    );
  }

  function switchActive(barber: AdminBarber) {
    toggle.mutate(
      { id: barber.id, active: !barber.active },
      {
        onSuccess: () =>
          toast.success(barber.active ? "Barber taken offline" : "Barber is back online"),
        onError: (cause) =>
          toast.error("Could not update the barber", {
            description: message(cause, "Please try again."),
          }),
      },
    );
  }

  const barbers = list.data ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Barbers</CardTitle>
        <CardDescription>
          Add a chair, then take it online or offline.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="barber-name">Name</Label>
            <Input
              id="barber-name"
              value={name}
              maxLength={64}
              placeholder="Bekzod R."
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="barber-title">Title</Label>
            <Input
              id="barber-title"
              value={title}
              maxLength={64}
              placeholder="Senior barber"
              onChange={(event) => setTitle(event.target.value)}
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="barber-bio">Bio</Label>
            <Textarea
              id="barber-bio"
              value={bio}
              maxLength={512}
              placeholder="A short line about their work."
              onChange={(event) => setBio(event.target.value)}
            />
          </div>
          <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
            <Button type="submit" className="h-10" disabled={create.isPending}>
              {create.isPending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <Plus className="size-4" aria-hidden />
              )}
              Add barber
            </Button>
            <FormError text={error} />
          </div>
        </form>

        <Separator className="my-6" />

        {list.isPending ? (
          <LoadingRows />
        ) : list.isError ? (
          <FormError text={message(list.error, "Could not load barbers.")} />
        ) : barbers.length === 0 ? (
          <Empty>No barbers yet.</Empty>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Bio</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {barbers.map((barber) => (
                <TableRow key={barber.id}>
                  <TableCell className="font-medium">{barber.name}</TableCell>
                  <TableCell>{barber.title || "—"}</TableCell>
                  <TableCell className="max-w-64 truncate text-muted-foreground">
                    {barber.bio || "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={barber.active ? "secondary" : "outline"}>
                      {barber.active ? "Active" : "Offline"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={toggle.isPending}
                      onClick={() => switchActive(barber)}
                    >
                      {toggle.isPending ? (
                        <Loader2 className="size-3 animate-spin" aria-hidden />
                      ) : null}
                      {barber.active ? "Take offline" : "Go online"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

/* --------------------------------------------------------------- services */

function ServicesSection() {
  const list = useAdminServices();
  const create = useCreateService();
  const toggle = useSetServiceActive();
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [price, setPrice] = useState("");
  const [time, setTime] = useState("30");
  const [formError, setFormError] = useState<string | null>(null);

  const error =
    formError ??
    (create.error ? message(create.error, "Could not add the service.") : null) ??
    (toggle.error ? message(toggle.error, "Could not update the service.") : null);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    if (!name.trim()) {
      setFormError("Give the service a name.");
      return;
    }
    if (!price.trim()) {
      setFormError("Enter a price in UZS.");
      return;
    }

    create.mutate(
      { name, note, price: Number(price), time: Number(time) },
      {
        onSuccess: () => {
          setName("");
          setNote("");
          setPrice("");
          setTime("30");
          toast.success("Service added");
        },
        onError: (cause) =>
          toast.error("Could not add the service", {
            description: message(cause, "Please try again."),
          }),
      },
    );
  }

  function switchActive(service: Service) {
    toggle.mutate(
      { id: service.id, active: !service.active },
      {
        onSuccess: () =>
          toast.success(service.active ? "Service taken off sale" : "Service is on sale"),
        onError: (cause) =>
          toast.error("Could not update the service", {
            description: message(cause, "Please try again."),
          }),
      },
    );
  }

  const services = list.data ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Services</CardTitle>
        <CardDescription>
          Prices in UZS, duration in minutes. Inactive items stay off the menu.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="service-name">Name</Label>
            <Input
              id="service-name"
              value={name}
              maxLength={64}
              placeholder="Signature cut"
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="service-note">Note</Label>
            <Input
              id="service-note"
              value={note}
              maxLength={256}
              placeholder="What the visit includes."
              onChange={(event) => setNote(event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="service-price">Price (UZS)</Label>
            <Input
              id="service-price"
              type="number"
              min={0}
              step={1000}
              value={price}
              placeholder="80000"
              onChange={(event) => setPrice(event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="service-time">Duration (minutes)</Label>
            <Input
              id="service-time"
              type="number"
              min={5}
              max={240}
              value={time}
              onChange={(event) => setTime(event.target.value)}
            />
          </div>
          <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
            <Button type="submit" className="h-10" disabled={create.isPending}>
              {create.isPending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <Plus className="size-4" aria-hidden />
              )}
              Add service
            </Button>
            <FormError text={error} />
          </div>
        </form>

        <Separator className="my-6" />

        {list.isPending ? (
          <LoadingRows />
        ) : list.isError ? (
          <FormError text={message(list.error, "Could not load services.")} />
        ) : services.length === 0 ? (
          <Empty>No services yet.</Empty>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Note</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Time</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {services.map((service) => (
                <TableRow key={service.id}>
                  <TableCell className="font-medium">{service.name}</TableCell>
                  <TableCell className="max-w-56 truncate text-muted-foreground">
                    {service.note || "—"}
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {formatPrice(service.price)}
                  </TableCell>
                  <TableCell className="tabular-nums">{service.time} min</TableCell>
                  <TableCell>
                    <Badge variant={service.active ? "secondary" : "outline"}>
                      {service.active ? "Active" : "Offline"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={toggle.isPending}
                      onClick={() => switchActive(service)}
                    >
                      {toggle.isPending ? (
                        <Loader2 className="size-3 animate-spin" aria-hidden />
                      ) : null}
                      {service.active ? "Take offline" : "Go online"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ hours */

function HoursSection() {
  const barbers = useAdminBarbers();
  const list = useAdminHours();
  const create = useCreateHour();
  const remove = useDeleteHour();
  const [barberId, setBarberId] = useState("");
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
    if (!barberId) {
      setFormError("Pick a barber.");
      return;
    }

    const from = parseTime(start);
    const to = parseTime(end);
    if (from === null || to === null || to <= from) {
      setFormError("Closing time must be after opening time.");
      return;
    }

    create.mutate(
      { barber: barberId, day: Number(day), start: from, end: to },
      {
        onSuccess: () => toast.success("Opening hours added"),
        onError: (cause) =>
          toast.error("Could not add opening hours", {
            description: message(cause, "Please try again."),
          }),
      },
    );
  }

  function removeHour(hour: Hour) {
    remove.mutate(hour.id, {
      onSuccess: () => toast.success("Opening hours removed"),
      onError: (cause) =>
        toast.error("Could not remove opening hours", {
          description: message(cause, "Please try again."),
        }),
    });
  }

  const hours = list.data ?? [];
  const names = new Map((barbers.data ?? []).map((item) => [item.id, item.name]));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Weekly hours</CardTitle>
        <CardDescription>
          Regular opening windows. A barber can have more than one a day.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="hour-barber">Barber</Label>
            <Select
              value={barberId}
              onValueChange={(value) => setBarberId(String(value ?? ""))}
            >
              <SelectTrigger id="hour-barber" className="h-9 w-full">
                <SelectValue placeholder="Pick a barber" />
              </SelectTrigger>
              <SelectContent>
                {(barbers.data ?? []).map((barber) => (
                  <SelectItem key={barber.id} value={barber.id}>
                    {barber.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="hour-day">Day</Label>
            <Select value={day} onValueChange={(value) => setDay(String(value))}>
              <SelectTrigger id="hour-day" className="h-9 w-full">
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
          <div className="space-y-1.5">
            <Label htmlFor="hour-start">Opens</Label>
            <Input
              id="hour-start"
              type="time"
              value={start}
              onChange={(event) => setStart(event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="hour-end">Closes</Label>
            <Input
              id="hour-end"
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

        {list.isPending ? (
          <LoadingRows />
        ) : list.isError ? (
          <FormError text={message(list.error, "Could not load opening hours.")} />
        ) : hours.length === 0 ? (
          <Empty>No weekly hours yet.</Empty>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Barber</TableHead>
                <TableHead>Day</TableHead>
                <TableHead>Hours</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {hours.map((hour) => (
                <TableRow key={hour.id}>
                  <TableCell className="font-medium">
                    {names.get(hour.barber) ?? hour.barber}
                  </TableCell>
                  <TableCell>{WEEKDAYS[hour.day] ?? "—"}</TableCell>
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
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------- days */

function DaysSection() {
  const barbers = useAdminBarbers();
  const list = useAdminDays();
  const create = useSaveDay();
  const remove = useDeleteDay();
  const [barberId, setBarberId] = useState("");
  const [date, setDate] = useState("");
  const [openValue, setOpenValue] = useState("open");
  const [start, setStart] = useState("10:00");
  const [end, setEnd] = useState("21:00");
  const [note, setNote] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const open = openValue === "open";

  const error =
    formError ??
    (create.error ? message(create.error, "Could not save the override.") : null) ??
    (remove.error ? message(remove.error, "Could not remove the override.") : null);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    if (!barberId) {
      setFormError("Pick a barber.");
      return;
    }
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

    create.mutate(
      { barber: barberId, date, open, start: from, end: to, note },
      {
        onSuccess: () => toast.success("Date override saved"),
        onError: (cause) =>
          toast.error("Could not save the override", {
            description: message(cause, "Please try again."),
          }),
      },
    );
  }

  function removeOverride(day: DayOverride) {
    remove.mutate(day.id, {
      onSuccess: () => toast.success("Date override removed"),
      onError: (cause) =>
        toast.error("Could not remove the override", {
          description: message(cause, "Please try again."),
        }),
    });
  }

  const days = list.data ?? [];
  const names = new Map((barbers.data ?? []).map((item) => [item.id, item.name]));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Date overrides</CardTitle>
        <CardDescription>
          Close a chair for a date, or set different hours. One per chair and date.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="day-barber">Barber</Label>
            <Select
              value={barberId}
              onValueChange={(value) => setBarberId(String(value ?? ""))}
            >
              <SelectTrigger id="day-barber" className="h-9 w-full">
                <SelectValue placeholder="Pick a barber" />
              </SelectTrigger>
              <SelectContent>
                {(barbers.data ?? []).map((barber) => (
                  <SelectItem key={barber.id} value={barber.id}>
                    {barber.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="day-date">Date</Label>
            <Input
              id="day-date"
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="day-open">Shop</Label>
            <Select
              value={openValue}
              onValueChange={(value) => setOpenValue(String(value))}
            >
              <SelectTrigger id="day-open" className="h-9 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="day-note">Note</Label>
            <Input
              id="day-note"
              value={note}
              maxLength={64}
              placeholder="Holiday, early close…"
              onChange={(event) => setNote(event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="day-start">Opens</Label>
            <Input
              id="day-start"
              type="time"
              value={start}
              disabled={!open}
              onChange={(event) => setStart(event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="day-end">Closes</Label>
            <Input
              id="day-end"
              type="time"
              value={end}
              disabled={!open}
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
              Save override
            </Button>
            <FormError text={error} />
          </div>
        </form>

        <Separator className="my-6" />

        {list.isPending ? (
          <LoadingRows />
        ) : list.isError ? (
          <FormError text={message(list.error, "Could not load overrides.")} />
        ) : days.length === 0 ? (
          <Empty>No date overrides yet.</Empty>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Barber</TableHead>
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
                    {names.get(day.barber) ?? day.barber}
                  </TableCell>
                  <TableCell>{formatDate(day.date)}</TableCell>
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
      </CardContent>
    </Card>
  );
}
