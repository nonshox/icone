"use client";

import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { Fragment, useState, type FormEvent, type ReactNode } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { Textarea } from "@/components/ui/textarea";
import { T } from "@/components/i18n/t";
import { useT } from "@/lib/i18n/use-t";
import {
  useAdminBarbers,
  useAdminDays,
  useAdminHours,
  useAdminReviews,
  useAdminServices,
  useAdminUsers,
  useCreateBarber,
  useCreateHour,
  useCreateService,
  useDeleteDay,
  useDeleteHour,
  useDeleteReview,
  useLinkBarberUser,
  useSaveDay,
  useSetBarberActive,
  useSetServiceActive,
  useSetUserRole,
  useUpdateBarber,
  useUpdateBarber as useUnlinkChair,
  useUpdateService,
  type AdminBarber,
  type AdminUser,
  type DayOverride,
  type Hour,
  type Service,
} from "@/lib/api/admin-queries";
import { formatDate, formatPrice, label, parseTime } from "@/lib/domain/time";
import type { Role } from "@/lib/domain/types";

import { Empty, FormError, LoadingRows, Section, message } from "./admin-ui";

const TABS = [
  { id: "barbers", key: "admin.nav.barbers" },
  { id: "team", key: "admin.catalogue.team" },
  { id: "services", key: "admin.services" },
  { id: "hours", key: "admin.weeklyHours" },
  { id: "days", key: "admin.dateOverrides" },
  { id: "reviews", key: "admin.reviews" },
] as const;

type Tab = (typeof TABS)[number]["id"];

type HourView = Hour & { id: string; barber: string };
type DayView = DayOverride & { id: string; barber: string };

function Field({ label: name, wide, children }: { label: ReactNode; wide?: boolean; children: ReactNode }) {
  return (
    <div className={`space-y-1.5 ${wide ? "sm:col-span-2" : ""}`}>
      <Label>
        {name}
        {children}
      </Label>
    </div>
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
            <T k={item.key} />
          </Button>
        ))}
      </nav>

      {tab === "barbers" ? <BarbersSection /> : null}
      {tab === "team" ? <TeamSection /> : null}
      {tab === "services" ? <ServicesSection /> : null}
      {tab === "hours" ? <HoursSection /> : null}
      {tab === "days" ? <DaysSection /> : null}
      {tab === "reviews" ? <ReviewsSection /> : null}
    </div>
  );
}

/* ---------------------------------------------------------------- reviews */

function ReviewsSection() {
  const t = useT();
  const list = useAdminReviews();
  const remove = useDeleteReview();
  const [errorText, setErrorText] = useState<string | null>(null);

  return (
    <Section title={<T k="admin.reviews" />} description={<T k="admin.reviewsDesc" />}>
      <FormError text={errorText} />
      {list.isPending ? (
        <LoadingRows />
      ) : list.isError ? (
        <FormError text={message(list.error, t("admin.loadError"))} />
      ) : (list.data ?? []).length === 0 ? (
        <Empty><T k="admin.noReviews" /></Empty>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead><T k="common.member" /></TableHead>
                <TableHead><T k="admin.rating" /></TableHead>
                <TableHead><T k="common.note" /></TableHead>
                <TableHead><T k="common.date" /></TableHead>
                <TableHead className="text-right"><T k="admin.actions" /></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(list.data ?? []).map((review) => (
                <TableRow key={review.id}>
                  <TableCell className="font-mono text-xs">{review.user.slice(0, 12)}</TableCell>
                  <TableCell className="tabular-nums">{review.rate}/5</TableCell>
                  <TableCell className="max-w-64 whitespace-normal">{review.note || "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {review.created.slice(0, 10)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      type="button"
                      size="xs"
                      variant="destructive"
                      disabled={remove.isPending}
                      onClick={() => {
                        if (!window.confirm(t("admin.confirmRemoveReview"))) return;
                        remove.mutate(review.id, {
                          onSuccess: () => toast.success(t("admin.removed")),
                          onError: (cause) =>
                            setErrorText(message(cause, t("admin.saveError"))),
                        });
                      }}
                    >
                      <Trash2 className="size-3" aria-hidden />
                      <T k="common.remove" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </Section>
  );
}

/* ---------------------------------------------------------------- barbers */

function BarbersSection() {
  const t = useT();
  const list = useAdminBarbers();
  const users = useAdminUsers();
  const create = useCreateBarber();
  const toggle = useSetBarberActive();
  const update = useUpdateBarber();

  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [bio, setBio] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editBio, setEditBio] = useState("");
  const [editPhoto, setEditPhoto] = useState("");
  const [editUser, setEditUser] = useState("");

  const error =
    formError ??
    (create.error ? message(create.error, t("admin.saveError")) : null) ??
    (toggle.error ? message(toggle.error, t("admin.saveError")) : null) ??
    (update.error ? message(update.error, t("admin.saveError")) : null) ??
    (list.error ? message(list.error, t("admin.loadError")) : null);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    if (!name.trim()) {
      setFormError(t("admin.nameError"));
      return;
    }

    create.mutate(
      { name, title, bio },
      {
        onSuccess: () => {
          setName("");
          setTitle("");
          setBio("");
          toast.success(t("admin.created"));
        },
        onError: (cause) => toast.error(message(cause, t("admin.saveError"))),
      },
    );
  }

  function switchActive(barber: AdminBarber) {
    toggle.mutate(
      { id: barber.id, active: !barber.active },
      { onSuccess: () => toast.success(t("admin.saved")),
        onError: (cause) => toast.error(message(cause, t("admin.saveError"))) },
    );
  }

  function startEdit(barber: AdminBarber) {
    setEditingId(barber.id);
    setEditTitle(barber.title);
    setEditBio(barber.bio);
    setEditPhoto(barber.photo);
    setEditUser(barber.user);
  }

  function saveEdit(barber: AdminBarber) {
    update.mutate(
      {
        id: barber.id,
        title: editTitle,
        bio: editBio,
        photo: editPhoto,
        user: editUser,
      },
      {
        onSuccess: () => {
          setEditingId(null);
          toast.success(t("admin.saved"));
        },
        onError: (cause) => toast.error(message(cause, t("admin.saveError"))),
      },
    );
  }

  const barbers = list.data ?? [];
  const userNames = new Map(
    (users.data ?? []).map((user) => [user.id, user.name || user.phone]),
  );

  return (
    <Section title={<T k="admin.nav.barbers" />} description={<T k="admin.addBarberHint" />}>
      <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
        <Field label={<T k="common.name" />}>
          <Input
            value={name}
            maxLength={64}
            onChange={(event) => setName(event.target.value)}
          />
        </Field>
        <Field label={<T k="admin.barberTitle" />}>
          <Input
            value={title}
            maxLength={64}
            onChange={(event) => setTitle(event.target.value)}
          />
        </Field>
        <Field label={<T k="admin.bio" />} wide>
          <Textarea
            value={bio}
            maxLength={1024}
            onChange={(event) => setBio(event.target.value)}
          />
        </Field>
        <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
          <Button type="submit" disabled={create.isPending}>
            {create.isPending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Plus className="size-4" aria-hidden />
            )}
            <T k="admin.addBarber" />
          </Button>
          <FormError text={error} />
        </div>
      </form>

      <Separator className="my-6" />

      {list.isPending ? (
        <LoadingRows />
      ) : barbers.length === 0 ? (
        <Empty><T k="admin.noBarbers" /></Empty>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead><T k="common.name" /></TableHead>
                <TableHead><T k="admin.barberTitle" /></TableHead>
                <TableHead><T k="common.member" /></TableHead>
                <TableHead><T k="common.status" /></TableHead>
                <TableHead className="text-right"><T k="admin.actions" /></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {barbers.map((barber) => (
                <Fragment key={barber.id}>
                  <TableRow>
                    <TableCell className="font-medium">{barber.name}</TableCell>
                    <TableCell>{barber.title || "—"}</TableCell>
                    <TableCell className="max-w-40 truncate text-muted-foreground">
                      {barber.user ? (userNames.get(barber.user) ?? barber.user) : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={barber.active ? "secondary" : "outline"}>
                        {barber.active ? t("admin.active") : t("admin.offline")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex flex-wrap justify-end gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            editingId === barber.id ? setEditingId(null) : startEdit(barber)
                          }
                        >
                          {editingId === barber.id ? (
                            <T k="common.cancel" />
                          ) : (
                            <>
                              <Pencil className="size-3" aria-hidden />
                              <T k="common.edit" />
                            </>
                          )}
                        </Button>
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
                          {barber.active ? t("admin.suspend") : t("admin.reactivate")}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                  {editingId === barber.id ? (
                    <TableRow>
                      <TableCell colSpan={5}>
                        <form
                          onSubmit={(event) => {
                            event.preventDefault();
                            saveEdit(barber);
                          }}
                          className="grid gap-3 rounded-lg border bg-muted/30 p-3 sm:grid-cols-2"
                        >
                          <Field label={<T k="admin.barberTitle" />}>
                            <Input
                              value={editTitle}
                              maxLength={64}
                              onChange={(event) => setEditTitle(event.target.value)}
                            />
                          </Field>
                          <Field label={<T k="admin.photoUrl" />}>
                            <Input
                              value={editPhoto}
                              maxLength={512}
                              onChange={(event) => setEditPhoto(event.target.value)}
                            />
                          </Field>
                          <Field label={<T k="admin.bio" />} wide>
                            <Textarea
                              value={editBio}
                              maxLength={1024}
                              onChange={(event) => setEditBio(event.target.value)}
                            />
                          </Field>
                          <Field label={<T k="common.member" />} wide>
                            <Select
                              value={editUser || "none"}
                              onValueChange={(value) =>
                                setEditUser(value === "none" ? "" : String(value ?? ""))
                              }
                            >
                              <SelectTrigger className="h-9 w-full">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none"><T k="admin.noChair" /></SelectItem>
                                {(users.data ?? []).map((user) => (
                                  <SelectItem key={user.id} value={user.id}>
                                    {user.name || user.phone}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </Field>
                          <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
                            <Button type="submit" size="sm" disabled={update.isPending}>
                              {update.isPending ? (
                                <Loader2 className="size-3 animate-spin" aria-hidden />
                              ) : null}
                              <T k="common.save" />
                            </Button>
                          </div>
                        </form>
                      </TableCell>
                    </TableRow>
                  ) : null}
                </Fragment>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </Section>
  );
}

/* ------------------------------------------------------------------- team */

function TeamSection() {
  const t = useT();
  const list = useAdminUsers();
  const chairs = useAdminBarbers();
  const setRole = useSetUserRole();
  const link = useLinkBarberUser();
  const unlink = useUnlinkChair();

  const chairByUser = new Map(
    (chairs.data ?? [])
      .filter((chair) => Boolean(chair.user))
      .map((chair) => [chair.user, chair.id]),
  );
  const chairOf = (user: AdminUser) => user.barber || chairByUser.get(user.id) || "";

  const busy = setRole.isPending || link.isPending || unlink.isPending;
  const error =
    (list.error ? message(list.error, t("admin.loadError")) : null) ??
    (chairs.error ? message(chairs.error, t("admin.loadError")) : null);

  function changeRole(user: AdminUser, role: string) {
    setRole.mutate(
      { userId: user.id, role: role as Role },
      {
        onSuccess: () => toast.success(t("admin.roleUpdated")),
        onError: (cause) => toast.error(message(cause, t("admin.saveError"))),
      },
    );
  }

  function changeChair(user: AdminUser, barber: string) {
    const current = chairOf(user);
    if (barber === "none" && !current) return;

    const onError = (cause: unknown) => toast.error(message(cause, t("admin.saveError")));
    if (barber === "none") {
      unlink.mutate(
        { id: current, user: "" },
        { onSuccess: () => toast.success(t("admin.chairUpdated")), onError },
      );
      return;
    }
    link.mutate(
      { userId: user.id, barber },
      { onSuccess: () => toast.success(t("admin.chairUpdated")), onError },
    );
  }

  return (
    <Section title={<T k="admin.catalogue.team" />} description={<T k="admin.users.description" />}>
      <FormError text={error} />
      {list.isPending ? (
        <LoadingRows />
      ) : (list.data ?? []).length === 0 ? (
        <Empty><T k="admin.noUsers" /></Empty>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead><T k="common.member" /></TableHead>
                <TableHead><T k="common.phone" /></TableHead>
                <TableHead><T k="admin.role" /></TableHead>
                <TableHead><T k="admin.chair" /></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(list.data ?? []).map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.name || "—"}</TableCell>
                  <TableCell className="max-w-56 truncate text-muted-foreground">
                    {user.phone || user.id.slice(0, 8)}
                  </TableCell>
                  <TableCell>
                    <Select
                      value={user.role}
                      disabled={busy}
                      onValueChange={(value) => changeRole(user, String(value))}
                    >
                      <SelectTrigger
                        aria-label={`${t("admin.role")}: ${user.name || user.phone}`}
                        className="h-9 w-32"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="client"><T k="admin.clients" /></SelectItem>
                        <SelectItem value="barber"><T k="admin.barberAccounts" /></SelectItem>
                        <SelectItem value="admin"><T k="admin.adminAccounts" /></SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Select
                      value={chairOf(user) || "none"}
                      disabled={busy}
                      onValueChange={(value) => changeChair(user, String(value))}
                    >
                      <SelectTrigger
                        aria-label={`${t("admin.chair")}: ${user.name || user.phone}`}
                        className="h-9 w-40"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none"><T k="admin.noChair" /></SelectItem>
                        {(chairs.data ?? []).map((chair) => (
                          <SelectItem key={chair.id} value={chair.id}>{chair.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </Section>
  );
}

/* --------------------------------------------------------------- services */

function ServicesSection() {
  const t = useT();
  const list = useAdminServices();
  const barbers = useAdminBarbers();
  const create = useCreateService();
  const toggle = useSetServiceActive();
  const update = useUpdateService();

  const [owner, setOwner] = useState("");
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [price, setPrice] = useState("");
  const [time, setTime] = useState("30");
  const [formError, setFormError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editNote, setEditNote] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [editTime, setEditTime] = useState("30");

  const error =
    formError ??
    (create.error ? message(create.error, t("admin.saveError")) : null) ??
    (toggle.error ? message(toggle.error, t("admin.saveError")) : null) ??
    (update.error ? message(update.error, t("admin.saveError")) : null) ??
    (list.error ? message(list.error, t("admin.loadError")) : null);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    if (!owner) {
      setFormError(t("admin.pickBarber"));
      return;
    }
    if (!name.trim()) {
      setFormError(t("admin.nameError"));
      return;
    }
    if (!price.trim() || !Number.isFinite(Number(price))) {
      setFormError(t("admin.priceError"));
      return;
    }

    // The service route needs the chair that owns the item.
    const input = { name, note, price: Number(price), time: Number(time), barber: owner };
    create.mutate(input, {
      onSuccess: () => {
        setName("");
        setNote("");
        setPrice("");
        setTime("30");
        toast.success(t("admin.created"));
      },
      onError: (cause) => toast.error(message(cause, t("admin.saveError"))),
    });
  }

  function switchActive(service: Service) {
    toggle.mutate(
      { id: service.id, active: !service.active },
      {
        onSuccess: () => toast.success(t("admin.saved")),
        onError: (cause) => toast.error(message(cause, t("admin.saveError"))),
      },
    );
  }

  function startEdit(service: Service) {
    setEditingId(service.id);
    setEditName(service.name);
    setEditNote(service.note);
    setEditPrice(String(service.price));
    setEditTime(String(service.time));
  }

  function saveEdit(service: Service) {
    if (!editName.trim()) {
      setFormError(t("admin.nameError"));
      return;
    }
    if (!editPrice.trim() || !Number.isFinite(Number(editPrice))) {
      setFormError(t("admin.priceError"));
      return;
    }
    setFormError(null);
    update.mutate(
      {
        id: service.id,
        name: editName,
        note: editNote,
        price: Number(editPrice),
        time: Number(editTime),
      },
      {
        onSuccess: () => {
          setEditingId(null);
          toast.success(t("admin.saved"));
        },
        onError: (cause) => toast.error(message(cause, t("admin.saveError"))),
      },
    );
  }

  const services = list.data ?? [];
  const names = new Map((barbers.data ?? []).map((item) => [item.id, item.name]));

  return (
    <Section title={<T k="admin.services" />} description={<T k="admin.servicesDesc" />}>
      <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
        <Field label={<T k="admin.chair" />}>
          <Select value={owner} onValueChange={(value) => setOwner(String(value ?? ""))}>
            <SelectTrigger className="h-9 w-full">
              <SelectValue placeholder={t("admin.pickBarber")} />
            </SelectTrigger>
            <SelectContent>
              {(barbers.data ?? []).map((barber) => (
                <SelectItem key={barber.id} value={barber.id}>{barber.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label={<T k="common.name" />}>
          <Input value={name} maxLength={64} onChange={(event) => setName(event.target.value)} />
        </Field>
        <Field label={<T k="common.note" />}>
          <Input value={note} maxLength={256} onChange={(event) => setNote(event.target.value)} />
        </Field>
        <Field label={<T k="admin.priceUzs" />}>
          <Input
            type="number"
            min={0}
            step={1000}
            value={price}
            onChange={(event) => setPrice(event.target.value)}
          />
        </Field>
        <Field label={<T k="admin.durationMin" />}>
          <Input
            type="number"
            min={5}
            max={480}
            value={time}
            onChange={(event) => setTime(event.target.value)}
          />
        </Field>
        <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
          <Button type="submit" disabled={create.isPending}>
            {create.isPending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Plus className="size-4" aria-hidden />
            )}
            <T k="admin.addService" />
          </Button>
          <FormError text={error} />
        </div>
      </form>

      <Separator className="my-6" />

      {list.isPending ? (
        <LoadingRows />
      ) : services.length === 0 ? (
        <Empty><T k="admin.noServices" /></Empty>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead><T k="common.name" /></TableHead>
                <TableHead><T k="admin.chair" /></TableHead>
                <TableHead><T k="common.price" /></TableHead>
                <TableHead><T k="common.time" /></TableHead>
                <TableHead><T k="common.status" /></TableHead>
                <TableHead className="text-right"><T k="admin.actions" /></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {services.map((service) => (
                <Fragment key={service.id}>
                  <TableRow>
                    <TableCell className="font-medium">{service.name}</TableCell>
                    <TableCell className="max-w-40 truncate text-muted-foreground">
                      {service.barber ? (names.get(service.barber) ?? service.barber) : service.business || "—"}
                    </TableCell>
                    <TableCell className="tabular-nums">{formatPrice(service.price)}</TableCell>
                    <TableCell className="tabular-nums">{service.time} min</TableCell>
                    <TableCell>
                      <Badge variant={service.active ? "secondary" : "outline"}>
                        {service.active ? t("admin.active") : t("admin.offline")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex flex-wrap justify-end gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            editingId === service.id ? setEditingId(null) : startEdit(service)
                          }
                        >
                          {editingId === service.id ? (
                            <T k="common.cancel" />
                          ) : (
                            <>
                              <Pencil className="size-3" aria-hidden />
                              <T k="common.edit" />
                            </>
                          )}
                        </Button>
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
                          {service.active ? t("admin.suspend") : t("admin.reactivate")}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                  {editingId === service.id ? (
                    <TableRow>
                      <TableCell colSpan={6}>
                        <form
                          onSubmit={(event) => {
                            event.preventDefault();
                            saveEdit(service);
                          }}
                          className="grid gap-3 rounded-lg border bg-muted/30 p-3 sm:grid-cols-2"
                        >
                          <Field label={<T k="common.name" />}>
                            <Input
                              value={editName}
                              maxLength={64}
                              onChange={(event) => setEditName(event.target.value)}
                            />
                          </Field>
                          <Field label={<T k="common.note" />}>
                            <Input
                              value={editNote}
                              maxLength={256}
                              onChange={(event) => setEditNote(event.target.value)}
                            />
                          </Field>
                          <Field label={<T k="admin.priceUzs" />}>
                            <Input
                              type="number"
                              min={0}
                              step={1000}
                              value={editPrice}
                              onChange={(event) => setEditPrice(event.target.value)}
                            />
                          </Field>
                          <Field label={<T k="admin.durationMin" />}>
                            <Input
                              type="number"
                              min={5}
                              max={480}
                              value={editTime}
                              onChange={(event) => setEditTime(event.target.value)}
                            />
                          </Field>
                          <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
                            <Button type="submit" size="sm" disabled={update.isPending}>
                              {update.isPending ? (
                                <Loader2 className="size-3 animate-spin" aria-hidden />
                              ) : null}
                              <T k="common.save" />
                            </Button>
                          </div>
                        </form>
                      </TableCell>
                    </TableRow>
                  ) : null}
                </Fragment>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </Section>
  );
}

/* ------------------------------------------------------------------ hours */

function HoursSection() {
  const t = useT();
  const barbers = useAdminBarbers();
  const list = useAdminHours();
  const create = useCreateHour();
  const remove = useDeleteHour();
  const [barberId, setBarberId] = useState("");
  const [day, setDay] = useState("1");
  const [start, setStart] = useState("10:00");
  const [end, setEnd] = useState("21:00");
  const [formError, setFormError] = useState<string | null>(null);

  const hours = (list.data ?? []) as unknown as HourView[];
  const names = new Map((barbers.data ?? []).map((item) => [item.id, item.name]));
  const error =
    formError ??
    (create.error ? message(create.error, t("admin.saveError")) : null) ??
    (remove.error ? message(remove.error, t("admin.saveError")) : null) ??
    (list.error ? message(list.error, t("admin.loadError")) : null);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    if (!barberId) {
      setFormError(t("admin.pickBarber"));
      return;
    }
    const from = parseTime(start);
    const to = parseTime(end);
    if (from === null || to === null || to <= from) {
      setFormError(t("admin.closeAfterOpen"));
      return;
    }
    create.mutate(
      { barber: barberId, day: Number(day), start: from, end: to },
      {
        onSuccess: () => {
          toast.success(t("admin.created"));
        },
        onError: (cause) => toast.error(message(cause, t("admin.saveError"))),
      },
    );
  }

  return (
    <Section title={<T k="admin.weeklyHours" />} description={<T k="admin.hoursDesc" />}>
      <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
        <Field label={<T k="admin.chair" />}>
          <Select value={barberId} onValueChange={(value) => setBarberId(String(value ?? ""))}>
            <SelectTrigger className="h-9 w-full">
              <SelectValue placeholder={t("admin.pickBarber")} />
            </SelectTrigger>
            <SelectContent>
              {(barbers.data ?? []).map((barber) => (
                <SelectItem key={barber.id} value={barber.id}>{barber.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label={<T k="admin.weekday" />}>
          <Select value={day} onValueChange={(value) => setDay(String(value))}>
            <SelectTrigger className="h-9 w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              {Array.from({ length: 7 }, (_, index) => (
                <SelectItem key={index} value={String(index)}>
                  {t(`day.${index}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label={<T k="admin.opens" />}>
          <Input type="time" value={start} onChange={(event) => setStart(event.target.value)} />
        </Field>
        <Field label={<T k="admin.closes" />}>
          <Input type="time" value={end} onChange={(event) => setEnd(event.target.value)} />
        </Field>
        <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
          <Button type="submit" disabled={create.isPending}>
            {create.isPending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Plus className="size-4" aria-hidden />
            )}
            <T k="admin.addHours" />
          </Button>
          <FormError text={error} />
        </div>
      </form>

      <Separator className="my-6" />

      {list.isPending ? (
        <LoadingRows />
      ) : hours.length === 0 ? (
        <Empty><T k="admin.noHours" /></Empty>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead><T k="admin.chair" /></TableHead>
                <TableHead><T k="admin.weekday" /></TableHead>
                <TableHead><T k="common.time" /></TableHead>
                <TableHead className="text-right"><T k="admin.actions" /></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {hours.map((hour) => (
                <TableRow key={hour.id}>
                  <TableCell className="font-medium">
                    {names.get(hour.barber) ?? hour.barber}
                  </TableCell>
                  <TableCell>{t(`day.${hour.day}`)}</TableCell>
                  <TableCell className="tabular-nums">
                    {label(hour.start)}–{label(hour.end)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="destructive"
                      aria-label={t("admin.removeHours")}
                      disabled={remove.isPending}
                      onClick={() =>
                        remove.mutate(hour.id, {
                          onSuccess: () => toast.success(t("admin.removed")),
                          onError: (cause) => toast.error(message(cause, t("admin.saveError"))),
                        })
                      }
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
    </Section>
  );
}

/* ------------------------------------------------------------------- days */

function DaysSection() {
  const t = useT();
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
  const days = (list.data ?? []) as unknown as DayView[];
  const names = new Map((barbers.data ?? []).map((item) => [item.id, item.name]));
  const error =
    formError ??
    (create.error ? message(create.error, t("admin.saveError")) : null) ??
    (remove.error ? message(remove.error, t("admin.saveError")) : null) ??
    (list.error ? message(list.error, t("admin.loadError")) : null);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    if (!barberId) {
      setFormError(t("admin.pickBarber"));
      return;
    }
    if (!date) {
      setFormError(t("admin.pickDate"));
      return;
    }
    let from = 0;
    let to = 0;
    if (open) {
      const parsedStart = parseTime(start);
      const parsedEnd = parseTime(end);
      if (parsedStart === null || parsedEnd === null || parsedEnd <= parsedStart) {
        setFormError(t("admin.closeAfterOpen"));
        return;
      }
      from = parsedStart;
      to = parsedEnd;
    }
    create.mutate(
      { barber: barberId, date, open, start: from, end: to, note },
      {
        onSuccess: () => toast.success(t("admin.saved")),
        onError: (cause) => toast.error(message(cause, t("admin.saveError"))),
      },
    );
  }

  return (
    <Section title={<T k="admin.dateOverrides" />} description={<T k="admin.daysDesc" />}>
      <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
        <Field label={<T k="admin.chair" />}>
          <Select value={barberId} onValueChange={(value) => setBarberId(String(value ?? ""))}>
            <SelectTrigger className="h-9 w-full">
              <SelectValue placeholder={t("admin.pickBarber")} />
            </SelectTrigger>
            <SelectContent>
              {(barbers.data ?? []).map((barber) => (
                <SelectItem key={barber.id} value={barber.id}>{barber.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label={<T k="common.date" />}>
          <Input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        </Field>
        <Field label={<T k="common.status" />}>
          <Select value={openValue} onValueChange={(value) => setOpenValue(String(value))}>
            <SelectTrigger className="h-9 w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="open"><T k="admin.openState" /></SelectItem>
              <SelectItem value="closed"><T k="admin.closedState" /></SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label={<T k="common.note" />}>
          <Input
            value={note}
            maxLength={64}
            onChange={(event) => setNote(event.target.value)}
          />
        </Field>
        <Field label={<T k="admin.opens" />}>
          <Input
            type="time"
            value={start}
            disabled={!open}
            onChange={(event) => setStart(event.target.value)}
          />
        </Field>
        <Field label={<T k="admin.closes" />}>
          <Input
            type="time"
            value={end}
            disabled={!open}
            onChange={(event) => setEnd(event.target.value)}
          />
        </Field>
        <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
          <Button type="submit" disabled={create.isPending}>
            {create.isPending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Plus className="size-4" aria-hidden />
            )}
            <T k="admin.saveOverride" />
          </Button>
          <FormError text={error} />
        </div>
      </form>

      <Separator className="my-6" />

      {list.isPending ? (
        <LoadingRows />
      ) : days.length === 0 ? (
        <Empty><T k="admin.noDays" /></Empty>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead><T k="admin.chair" /></TableHead>
                <TableHead><T k="common.date" /></TableHead>
                <TableHead><T k="common.status" /></TableHead>
                <TableHead><T k="common.time" /></TableHead>
                <TableHead><T k="common.note" /></TableHead>
                <TableHead className="text-right"><T k="admin.actions" /></TableHead>
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
                      {day.open ? t("admin.openState") : t("admin.closedState")}
                    </Badge>
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {day.open ? `${label(day.start)}–${label(day.end)}` : "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{day.note || "—"}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="destructive"
                      aria-label={t("admin.removeOverride")}
                      disabled={remove.isPending}
                      onClick={() =>
                        remove.mutate(day.id, {
                          onSuccess: () => toast.success(t("admin.removed")),
                          onError: (cause) => toast.error(message(cause, t("admin.saveError"))),
                        })
                      }
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
    </Section>
  );
}
