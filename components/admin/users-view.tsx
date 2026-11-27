"use client";

import { Loader2, Search } from "lucide-react";
import { Fragment, useMemo, useState } from "react";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { T } from "@/components/i18n/t";
import { useT } from "@/lib/i18n/use-t";
import {
  useAdminBarbers,
  useAdminUsers,
  useLinkBarberUser,
  useSetUserRole,
  useSetUserStatus,
  useUpdateBarber,
  type AdminUser,
} from "@/lib/api/admin-queries";
import { useProfile } from "@/lib/api/queries";
import type { Role } from "@/lib/domain/types";

import {
  Empty,
  FormError,
  LoadingRows,
  Section,
  message,
} from "./admin-ui";

export function UsersView() {
  const t = useT();
  const list = useAdminUsers();
  const chairs = useAdminBarbers();
  const me = useProfile();
  const setRole = useSetUserRole();
  const link = useLinkBarberUser();
  const setStatus = useSetUserStatus();
  const unlink = useUpdateBarber();

  const [search, setSearch] = useState("");
  const [role, setRoleFilter] = useState("all");
  const [state, setStateFilter] = useState("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);

  const users = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (list.data ?? []).filter((user) => {
      if (role !== "all" && user.role !== role) return false;
      if (state !== "all" && user.state !== state) return false;
      if (!term) return true;
      return [user.name, user.phone, user.id]
        .some((field) => field.toLowerCase().includes(term));
    });
  }, [list.data, search, role, state]);

  /** The chair list is the source of truth for account links. */
  const chairByUser = new Map(
    (chairs.data ?? [])
      .filter((chair) => Boolean(chair.user))
      .map((chair) => [chair.user, chair.id]),
  );

  function chairOf(user: AdminUser): string {
    return user.barber || chairByUser.get(user.id) || "";
  }

  const busy = setRole.isPending || link.isPending || setStatus.isPending || unlink.isPending;
  const error =
    errorText ??
    (list.error ? message(list.error, t("admin.loadError")) : null) ??
    (chairs.error ? message(chairs.error, t("admin.loadError")) : null);

  function changeRole(user: AdminUser, next: string) {
    setErrorText(null);
    setRole.mutate(
      { userId: user.id, role: next as Role },
      {
        onSuccess: () => toast.success(t("admin.roleUpdated")),
        onError: (cause) => {
          const text = message(cause, t("admin.saveError"));
          setErrorText(text);
          toast.error(text);
        },
      },
    );
  }

  function changeChair(user: AdminUser, next: string) {
    const current = chairOf(user);
    if (next === "none" && !current) return;
    setErrorText(null);

    const onError = (cause: unknown) => {
      const text = message(cause, t("admin.saveError"));
      setErrorText(text);
      toast.error(text);
    };

    // Unlinking clears the chair's `user` field through the barber endpoint.
    if (next === "none") {
      unlink.mutate(
        { id: current, user: "" },
        { onSuccess: () => toast.success(t("admin.chairUpdated")), onError },
      );
      return;
    }

    link.mutate(
      { userId: user.id, barber: next },
      { onSuccess: () => toast.success(t("admin.chairUpdated")), onError },
    );
  }

  function toggleStatus(user: AdminUser) {
    if (me.data?.id === user.id) {
      toast.error(t("admin.selfStatusError"));
      return;
    }
    const suspending = user.state === "active";
    const question = suspending
      ? t("admin.confirmSuspend").replace("{name}", user.name || user.phone)
      : t("admin.confirmReactivate").replace("{name}", user.name || user.phone);
    if (!window.confirm(question)) return;

    setErrorText(null);
    setStatus.mutate(
      { userId: user.id, active: !suspending },
      {
        onSuccess: () =>
          toast.success(suspending ? t("admin.accountSuspended") : t("admin.accountReactivated")),
        onError: (cause) => {
          const text = message(cause, t("admin.saveError"));
          setErrorText(text);
          toast.error(text);
        },
      },
    );
  }

  return (
    <Section title={<T k="admin.usersTotal" />} description={<T k="admin.users.description" />}>
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="user-search"><T k="common.search" /></Label>
          <div className="relative">
            <Search
              className="absolute left-2 top-2.5 size-4 text-muted-foreground"
              aria-hidden
            />
            <Input
              id="user-search"
              value={search}
              placeholder={t("admin.searchHint")}
              className="pl-8"
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="user-role-filter"><T k="admin.role" /></Label>
          <Select value={role} onValueChange={(value) => setRoleFilter(String(value))}>
            <SelectTrigger id="user-role-filter" className="h-9 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all"><T k="admin.allRoles" /></SelectItem>
              <SelectItem value="client"><T k="admin.clients" /></SelectItem>
              <SelectItem value="barber"><T k="admin.barberAccounts" /></SelectItem>
              <SelectItem value="admin"><T k="admin.adminAccounts" /></SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="user-status-filter"><T k="common.status" /></Label>
          <Select value={state} onValueChange={(value) => setStateFilter(String(value))}>
            <SelectTrigger id="user-status-filter" className="h-9 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all"><T k="admin.allAccounts" /></SelectItem>
              <SelectItem value="active"><T k="admin.active" /></SelectItem>
              <SelectItem value="suspended"><T k="admin.suspended" /></SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <FormError text={error} />

      {list.isPending ? (
        <LoadingRows />
      ) : users.length === 0 ? (
        <Empty><T k="admin.emptyFilter" /></Empty>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead><T k="common.member" /></TableHead>
                <TableHead><T k="admin.role" /></TableHead>
                <TableHead><T k="admin.chair" /></TableHead>
                <TableHead><T k="common.status" /></TableHead>
                <TableHead className="text-right"><T k="admin.actions" /></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <Fragment key={user.id}>
                  <TableRow>
                    <TableCell>
                      <p className="font-medium">{user.name || user.phone || "—"}</p>
                      <p className="text-xs text-muted-foreground">
                        {user.phone || user.id.slice(0, 8)}
                      </p>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={user.role}
                        disabled={busy}
                        onValueChange={(value) => changeRole(user, String(value))}
                      >
                        <SelectTrigger
                          aria-label={`${t("admin.role")}: ${user.name || user.phone}`}
                          className="h-9 w-28"
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
                            <SelectItem key={chair.id} value={chair.id}>
                              {chair.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Badge variant={user.state === "active" ? "secondary" : "destructive"}>
                        {user.state === "active" ? t("admin.active") : t("admin.suspended")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex flex-wrap justify-end gap-2">
                        <Button
                          type="button"
                          size="xs"
                          variant="outline"
                          onClick={() =>
                            setOpenId(openId === user.id ? null : user.id)
                          }
                        >
                          {openId === user.id ? <T k="common.close" /> : <T k="admin.details" />}
                        </Button>
                        <Button
                          type="button"
                          size="xs"
                          variant="outline"
                          disabled={busy || me.data?.id === user.id}
                          onClick={() => toggleStatus(user)}
                        >
                          {setStatus.isPending ? (
                            <Loader2 className="size-3 animate-spin" aria-hidden />
                          ) : null}
                          {user.state === "active" ? <T k="admin.suspend" /> : <T k="admin.reactivate" />}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                  {openId === user.id ? (
                    <TableRow>
                      <TableCell colSpan={5}>
                        <dl className="grid gap-2 rounded-lg border bg-muted/30 p-3 text-sm sm:grid-cols-2">
                          <div>
                            <dt className="text-xs text-muted-foreground"><T k="common.phone" /></dt>
                            <dd>{user.phone || "—"}</dd>
                          </div>
                          <div>
                            <dt className="text-xs text-muted-foreground"><T k="admin.joined" /></dt>
                            <dd>{user.created ? user.created.slice(0, 10) : "—"}</dd>
                          </div>
                          <div>
                            <dt className="text-xs text-muted-foreground"><T k="admin.accountId" /></dt>
                            <dd className="font-mono text-xs">{user.id}</dd>
                          </div>
                          <div>
                            <dt className="text-xs text-muted-foreground"><T k="admin.language" /></dt>
                            <dd>{user.locale || "—"}</dd>
                          </div>
                        </dl>
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
