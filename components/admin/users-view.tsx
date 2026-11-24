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
import {
  useAdminBarbers,
  useAdminUsers,
  useLinkBarberUser,
  useSetUserRole,
  useSetUserStatus,
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
  const list = useAdminUsers();
  const chairs = useAdminBarbers();
  const me = useProfile();
  const setRole = useSetUserRole();
  const link = useLinkBarberUser();
  const setStatus = useSetUserStatus();

  const [search, setSearch] = useState("");
  const [role, setRoleFilter] = useState("all");
  const [status, setStatusFilter] = useState("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);

  const users = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (list.data ?? []).filter((user) => {
      if (role !== "all" && user.role !== role) return false;
      if (status === "active" && !user.status) return false;
      if (status === "blocked" && user.status) return false;
      if (!term) return true;
      return [user.name, user.email, user.phone]
        .some((field) => field.toLowerCase().includes(term));
    });
  }, [list.data, search, role, status]);

  const busy = setRole.isPending || link.isPending || setStatus.isPending;
  const error =
    errorText ??
    (list.error ? message(list.error, "Could not load members.") : null) ??
    (chairs.error ? message(chairs.error, "Could not load chairs.") : null);

  function changeRole(user: AdminUser, next: string) {
    setErrorText(null);
    setRole.mutate(
      { userId: user.id, role: next as Role },
      {
        onSuccess: () => toast.success("Role updated"),
        onError: (cause) => {
          setErrorText(message(cause, "Could not update the role."));
          toast.error("Could not update the role");
        },
      },
    );
  }

  function changeChair(user: AdminUser, next: string) {
    setErrorText(null);
    link.mutate(
      { userId: user.id, barber: next === "none" ? "" : next },
      {
        onSuccess: () => toast.success("Chair updated"),
        onError: (cause) => {
          setErrorText(message(cause, "Could not update the chair."));
          toast.error("Could not update the chair");
        },
      },
    );
  }

  function toggleStatus(user: AdminUser) {
    if (me.data?.id === user.id) {
      toast.error("You cannot change your own account status");
      return;
    }
    if (!window.confirm(user.status ? `Block ${user.name || user.email}?` : `Reactivate ${user.name || user.email}?`)) {
      return;
    }
    setErrorText(null);
    setStatus.mutate(
      { userId: user.id, active: !user.status },
      {
        onSuccess: () =>
          toast.success(user.status ? "Account blocked" : "Account reactivated"),
        onError: (cause) => {
          setErrorText(message(cause, "Could not update the account."));
          toast.error("Could not update the account");
        },
      },
    );
  }

  return (
    <Section
      title="Members"
      description="Search accounts, assign roles and chairs, or block access."
    >
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="user-search">Search</Label>
          <div className="relative">
            <Search
              className="absolute left-2 top-2.5 size-4 text-muted-foreground"
              aria-hidden
            />
            <Input
              id="user-search"
              value={search}
              placeholder="Name, email or phone"
              className="pl-8"
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="user-role-filter">Role</Label>
          <Select value={role} onValueChange={(value) => setRoleFilter(String(value))}>
            <SelectTrigger id="user-role-filter" className="h-9 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All roles</SelectItem>
              <SelectItem value="client">Clients</SelectItem>
              <SelectItem value="barber">Barbers</SelectItem>
              <SelectItem value="admin">Admins</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="user-status-filter">Account</Label>
          <Select
            value={status}
            onValueChange={(value) => setStatusFilter(String(value))}
          >
            <SelectTrigger id="user-status-filter" className="h-9 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All accounts</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="blocked">Blocked</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <FormError text={error} />

      {list.isPending ? (
        <LoadingRows />
      ) : users.length === 0 ? (
        <Empty>No members match these filters.</Empty>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Member</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Chair</TableHead>
                <TableHead>Account</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <Fragment key={user.id}>
                  <TableRow>
                    <TableCell>
                      <p className="font-medium">{user.name || "—"}</p>
                      <p className="text-xs text-muted-foreground">
                        {user.email || user.phone || user.id.slice(0, 8)}
                      </p>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={user.role}
                        disabled={busy}
                        onValueChange={(value) => changeRole(user, String(value))}
                      >
                        <SelectTrigger
                          aria-label={`Role for ${user.name || user.email}`}
                          className="h-9 w-28"
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="client">Client</SelectItem>
                          <SelectItem value="barber">Barber</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={user.barber || "none"}
                        disabled={busy}
                        onValueChange={(value) => changeChair(user, String(value))}
                      >
                        <SelectTrigger
                          aria-label={`Chair for ${user.name || user.email}`}
                          className="h-9 w-40"
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No chair</SelectItem>
                          {(chairs.data ?? []).map((chair) => (
                            <SelectItem key={chair.id} value={chair.id}>
                              {chair.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Badge variant={user.status ? "secondary" : "destructive"}>
                        {user.status ? "Active" : "Blocked"}
                      </Badge>
                      {user.flags > 0 ? (
                        <span className="ml-2 text-xs text-muted-foreground">
                          {user.flags} low-rated
                        </span>
                      ) : null}
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
                          {openId === user.id ? "Hide" : "Profile"}
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
                          {user.status ? "Block" : "Reactivate"}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                  {openId === user.id ? (
                    <TableRow>
                      <TableCell colSpan={5}>
                        <dl className="grid gap-2 rounded-lg border bg-muted/30 p-3 text-sm sm:grid-cols-2">
                          <div>
                            <dt className="text-xs text-muted-foreground">Email</dt>
                            <dd className="truncate">{user.email || "—"}</dd>
                          </div>
                          <div>
                            <dt className="text-xs text-muted-foreground">Phone</dt>
                            <dd>{user.phone || "—"}</dd>
                          </div>
                          <div>
                            <dt className="text-xs text-muted-foreground">Joined</dt>
                            <dd>{user.created ? user.created.slice(0, 10) : "—"}</dd>
                          </div>
                          <div>
                            <dt className="text-xs text-muted-foreground">Account id</dt>
                            <dd className="font-mono text-xs">{user.id}</dd>
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
