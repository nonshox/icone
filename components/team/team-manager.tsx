"use client";

import { Loader2, Plus, Trash2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import {
  Empty,
  FormError,
  LoadingRows,
  message,
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
import {
  useBranches,
  useInviteMember,
  useRemoveMember,
  useRevokeInvite,
  useTeam,
  useUpdateMember,
  type Invite,
  type MemberPatch,
  type Membership,
  type TeamRole,
} from "@/lib/api/team-queries";
import { useT } from "@/lib/i18n/use-t";
import { TEAM_ROLES } from "@/lib/domain/types";

const BLANK = { role: "barber" as TeamRole, to: "", phone: "", name: "", branch: "" };

const selectClass =
  "h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring disabled:opacity-50";

function shortId(id: string): string {
  return id ? id.slice(0, 8) : "—";
}

function prettyPhone(value: string): string {
  const digits = value.replace(/\D/g, "");
  const local = digits.startsWith("998") ? digits.slice(3) : digits;
  return local.length === 9
    ? `+998 ${local.slice(0, 2)} ${local.slice(2, 5)} ${local.slice(5, 7)} ${local.slice(7)}`
    : value;
}

function permissions(perms: Record<string, boolean> | undefined): string {
  const granted = Object.entries(perms ?? {})
    .filter(([, value]) => value)
    .map(([key]) => key);
  return granted.length > 0 ? granted.join(", ") : "";
}

export function TeamManager({
  business,
  canManage,
  canPromoteOwner,
}: {
  business: string;
  canManage: boolean;
  canPromoteOwner: boolean;
}) {
  const t = useT();
  const team = useTeam(business);
  const branches = useBranches(business);
  const invite = useInviteMember();
  const update = useUpdateMember();
  const remove = useRemoveMember();
  const revoke = useRevokeInvite();

  const [form, setForm] = useState(BLANK);
  const [formError, setFormError] = useState<string | null>(null);

  const members = team.data?.members ?? [];
  const invites = team.data?.invites ?? [];
  const branchOptions = branches.data ?? [];
  const roles: readonly TeamRole[] = canPromoteOwner
    ? TEAM_ROLES
    : TEAM_ROLES.filter((role) => role !== "owner");

  function set<K extends keyof typeof BLANK>(key: K, value: (typeof BLANK)[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    const to = form.to.trim();
    const phone = form.phone.trim();
    if (!to && !phone) {
      setFormError(t("work.team.inviteRequired"));
      return;
    }

    invite.mutate(
      {
        business,
        role: form.role,
        to: to || undefined,
        phone: phone || undefined,
        name: form.name.trim() || undefined,
        branch: form.branch || undefined,
      },
      {
        onSuccess: () => {
          toast.success(t("work.toast.added"));
          setForm(BLANK);
        },
        onError: (error) => {
          const text = message(error, t("work.toast.failed"));
          setFormError(text);
          toast.error(text);
        },
      },
    );
  }

  function change(member: Membership, patch: Partial<MemberPatch>) {
    update.mutate(
      { id: member.id, business, ...patch },
      {
        onSuccess: () => toast.success(t("work.toast.updated")),
        onError: (error) => toast.error(message(error, t("work.toast.failed"))),
      },
    );
  }

  function removeMember(member: Membership) {
    const label =
      team.data?.members.find((row) => row.id === member.id)?.user ?? shortId(member.user);
    if (!window.confirm(`${t("common.remove")} ${label}?`)) return;
    remove.mutate(
      { member: member.id, business },
      {
        onSuccess: () => toast.success(t("work.toast.removed")),
        onError: (error) => toast.error(message(error, t("work.toast.failed"))),
      },
    );
  }

  function revokeInviteRow(row: Invite) {
    revoke.mutate(
      { invite: row.id, business },
      {
        onSuccess: () => toast.success(t("work.toast.removed")),
        onError: (error) => toast.error(message(error, t("work.toast.failed"))),
      },
    );
  }

  const branchSelect = (value: string, onChange: (value: string) => void, id: string) => (
    <select
      id={id}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      disabled={update.isPending}
      className={selectClass}
    >
      <option value="">{t("work.team.anyBranch")}</option>
      {branchOptions.map((branch) => (
        <option key={branch.id} value={branch.id}>
          {branch.name}
        </option>
      ))}
    </select>
  );

  return (
    <div className="space-y-6">
      {canManage ? (
        <Card className="glass">
          <CardHeader>
            <CardTitle>
              <T k="work.team.inviteTitle" />
            </CardTitle>
            <CardDescription>
              <T k="work.team.inviteHint" />
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="invite-role">
                  <T k="work.team.role" />
                </Label>
                <select
                  id="invite-role"
                  value={form.role}
                  onChange={(event) => set("role", event.target.value as TeamRole)}
                  className={selectClass}
                >
                  {roles.map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="invite-branch">
                  <T k="work.team.branch" />
                </Label>
                {branchSelect(form.branch, (value) => set("branch", value), "invite-branch")}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="invite-to">
                  <T k="work.team.account" />
                </Label>
                <Input
                  id="invite-to"
                  value={form.to}
                  maxLength={36}
                  onChange={(event) => set("to", event.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  <T k="work.team.accountHint" />
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="invite-phone">
                  <T k="common.phone" />
                </Label>
                <Input
                  id="invite-phone"
                  type="tel"
                  value={form.phone}
                  maxLength={32}
                  onChange={(event) => set("phone", event.target.value)}
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="invite-name">
                  <T k="common.name" />
                </Label>
                <Input
                  id="invite-name"
                  value={form.name}
                  maxLength={64}
                  onChange={(event) => set("name", event.target.value)}
                />
              </div>
              <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
                <Button type="submit" disabled={invite.isPending} className="h-10">
                  {invite.isPending ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                  ) : (
                    <Plus className="size-4" aria-hidden />
                  )}
                  <T k="work.team.inviteAction" />
                </Button>
                <FormError text={formError} />
              </div>
            </form>
          </CardContent>
        </Card>
      ) : (
        <Card className="glass">
          <CardContent className="py-4 text-sm text-muted-foreground">
            <T k="work.team.readOnly" />
          </CardContent>
        </Card>
      )}

      <Card className="glass">
        <CardHeader>
          <CardTitle>
            <T k="nav.team" />
          </CardTitle>
          <CardDescription>
            <T k="work.team.hint" />
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {team.isPending ? (
            <LoadingRows />
          ) : team.isError ? (
            <FormError text={message(team.error, t("work.loadError"))} />
          ) : members.length === 0 ? (
            <Empty>{t("work.team.empty")}</Empty>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <T k="common.member" />
                  </TableHead>
                  <TableHead>
                    <T k="work.team.role" />
                  </TableHead>
                  <TableHead>
                    <T k="work.team.branch" />
                  </TableHead>
                  <TableHead>
                    <T k="work.team.state" />
                  </TableHead>
                  <TableHead>
                    <T k="work.team.permissions" />
                  </TableHead>
                  {canManage ? (
                    <TableHead className="text-right">
                      <T k="work.agenda.actions" />
                    </TableHead>
                  ) : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell className="font-medium">
                      {member.user ? shortId(member.user) : "—"}
                    </TableCell>
                    <TableCell>
                      {canManage ? (
                        <select
                          aria-label={`${t("work.team.role")} ${shortId(member.user)}`}
                          value={member.role}
                          onChange={(event) =>
                            change(member, { role: event.target.value as TeamRole })
                          }
                          disabled={update.isPending}
                          className={`${selectClass} min-w-28`}
                        >
                          {roles.map((role) => (
                            <option key={role} value={role}>
                              {role}
                            </option>
                          ))}
                          {!roles.includes(member.role) ? (
                            <option value={member.role}>{member.role}</option>
                          ) : null}
                        </select>
                      ) : (
                        member.role
                      )}
                    </TableCell>
                    <TableCell>
                      {canManage ? (
                        branchSelect(
                          member.branch,
                          (value) => change(member, { branch: value }),
                          `member-branch-${member.id}`,
                        )
                      ) : (
                        branchOptions.find((branch) => branch.id === member.branch)?.name ?? "—"
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={member.state === "active" ? "secondary" : "outline"}
                      >
                        {member.state}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-48 truncate text-muted-foreground" title={permissions(member.perms)}>
                      {permissions(member.perms) || t("work.team.defaultPerms")}
                    </TableCell>
                    {canManage ? (
                      <TableCell className="text-right">
                        <div className="flex flex-wrap justify-end gap-1">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={update.isPending}
                            onClick={() => change(member, { active: !member.active })}
                          >
                            <T
                              k={member.active ? "work.team.deactivate" : "work.team.activate"}
                            />
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="destructive"
                            disabled={remove.isPending}
                            onClick={() => removeMember(member)}
                            aria-label={`${t("common.remove")} ${shortId(member.user)}`}
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

      <Card className="glass">
        <CardHeader>
          <CardTitle>
            <T k="work.team.invites" />
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {team.isPending ? (
            <LoadingRows />
          ) : team.isError ? (
            <FormError text={message(team.error, t("work.loadError"))} />
          ) : invites.length === 0 ? (
            <Empty>{t("work.team.noInvites")}</Empty>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <T k="common.name" />
                  </TableHead>
                  <TableHead>
                    <T k="work.team.role" />
                  </TableHead>
                  <TableHead>
                    <T k="work.team.state" />
                  </TableHead>
                  <TableHead>
                    <T k="work.team.expires" />
                  </TableHead>
                  {canManage ? (
                    <TableHead className="text-right">
                      <T k="work.agenda.actions" />
                    </TableHead>
                  ) : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {invites.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">
                      {row.name || prettyPhone(row.phone) || shortId(row.to)}
                    </TableCell>
                    <TableCell>{row.role}</TableCell>
                    <TableCell>
                      <Badge variant={row.state === "pending" ? "secondary" : "outline"}>
                        {row.state}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{row.expires}</TableCell>
                    {canManage ? (
                      <TableCell className="text-right">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={revoke.isPending || row.state !== "pending"}
                          onClick={() => revokeInviteRow(row)}
                        >
                          <T k="work.team.revoke" />
                        </Button>
                      </TableCell>
                    ) : null}
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
