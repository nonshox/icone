"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Empty, FormError, LoadingRows, message } from "@/components/barber/barber-ui";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  useAcceptInvite,
  useDeclineInvite,
  useMyInvitations,
  type Invite,
} from "@/lib/api/team-queries";
import { useT } from "@/lib/i18n/use-t";

function prettyPhone(value: string): string {
  const digits = value.replace(/\D/g, "");
  const local = digits.startsWith("998") ? digits.slice(3) : digits;
  return local.length === 9
    ? `+998 ${local.slice(0, 2)} ${local.slice(2, 5)} ${local.slice(5, 7)} ${local.slice(7)}`
    : value;
}

function shortId(id: string): string {
  return id ? id.slice(0, 8) : "—";
}

export function Invitations() {
  const t = useT();
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const invites = useMyInvitations();
  const accept = useAcceptInvite();
  const decline = useDeclineInvite();
  const [notice, setNotice] = useState("");

  const pending = (invites.data ?? []).filter((row) => row.state === "pending");

  function acceptInvite(row: Invite) {
    accept.mutate(row.token, {
      onSuccess: () => {
        setNotice(t("invites.joined"));
        toast.success(t("invites.joined"));
      },
      onError: (error) => {
        const text = message(error, t("invites.failed"));
        setNotice(text);
        toast.error(text);
      },
    });
  }

  function declineInvite(row: Invite) {
    decline.mutate(row.id, {
      onSuccess: () => toast.success(t("work.toast.removed")),
      onError: (error) => toast.error(message(error, t("invites.failed"))),
    });
  }

  useEffect(() => {
    if (token && !accept.isPending && !notice) {
      accept.mutate(token, {
        onSuccess: () => {
          setNotice(t("invites.joined"));
          toast.success(t("invites.joined"));
        },
        onError: (error) => {
          const text = message(error, t("invites.failed"));
          setNotice(text);
          toast.error(text);
        },
      });
    }
    // A deep link is accepted once per page load, even before the list resolves.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return (
    <div className="space-y-3">
      <Card className="glass">
        <CardHeader>
          <CardTitle>
            <T k="invites.title" />
          </CardTitle>
          <CardDescription>
            <T k="invites.subtitle" />
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {notice ? (
            <p role="status" className="mb-4 rounded-xl border border-brand bg-brand/10 p-3 text-sm">
              {notice}
            </p>
          ) : null}
          {invites.isPending ? (
            <LoadingRows />
          ) : invites.isError ? (
            <div className="space-y-3">
              <FormError text={message(invites.error, t("invites.loadError"))} />
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => void invites.refetch()}
              >
                <T k="common.tryAgain" />
              </Button>
            </div>
          ) : pending.length === 0 ? (
            <Empty>{t("invites.empty")}</Empty>
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
                    <T k="invites.expires" />
                  </TableHead>
                  <TableHead className="text-right">
                    <T k="work.agenda.actions" />
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pending.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">
                      {row.name || prettyPhone(row.phone) || shortId(row.to)}
                    </TableCell>
                    <TableCell>{row.role}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        <T k="status.pending" />
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{row.expires}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex flex-wrap justify-end gap-2">
                        <Button
                          type="button"
                          size="sm"
                          disabled={accept.isPending}
                          onClick={() => acceptInvite(row)}
                        >
                          <T k="invites.accept" />
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={decline.isPending}
                          onClick={() => declineInvite(row)}
                        >
                          <T k="invites.decline" />
                        </Button>
                      </div>
                    </TableCell>
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
