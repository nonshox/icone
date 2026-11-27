"use client";

import { Check, CheckCheck, Inbox } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

import { T } from "@/components/i18n/t";
import { ClientGate } from "@/components/customer/client-gate";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useMarkNotificationRead, useNotifications } from "@/lib/api/customer-queries";
import { useProfile } from "@/lib/api/queries";
import { useT } from "@/lib/i18n/use-t";
import { formatDate } from "@/lib/domain/time";

export function NotificationsView() {
  const t = useT();
  const profile = useProfile();
  const inbox = useNotifications();
  const mark = useMarkNotificationRead();

  function markOne(id: string) {
    mark.mutate(
      { id },
      {
        onSuccess: () => toast.success(t("inbox.marked")),
        onError: (error) =>
          toast.error(t("inbox.failed"), {
            description: error instanceof Error ? error.message : t("auth.tryAgain"),
          }),
      },
    );
  }

  function markAll() {
    mark.mutate(
      { all: true },
      {
        onSuccess: () => toast.success(t("inbox.cleared")),
        onError: (error) =>
          toast.error(t("inbox.failed"), {
            description: error instanceof Error ? error.message : t("auth.tryAgain"),
          }),
      },
    );
  }

  if (profile.isPending) {
    return (
      <div className="space-y-3" aria-hidden>
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (profile.isError || !profile.data) {
    return (
      <Card>
        <CardContent role="alert" className="py-10 text-center text-sm text-destructive">
          {t("customer.loadError")}
        </CardContent>
      </Card>
    );
  }

  const items = inbox.data?.notifications ?? [];
  const unread = inbox.data?.unread ?? 0;

  return (
    <ClientGate role={profile.data.role}>
      <div className="space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-medium tracking-[0.18em] text-brand-strong uppercase">
              <T k="inbox.title" />
            </p>
          </div>
          <div className="flex items-center gap-3">
            {unread > 0 ? (
              <Badge variant="secondary" className="tabular-nums">
                {unread} {t("inbox.unread")}
              </Badge>
            ) : null}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 rounded-xl"
              disabled={mark.isPending || unread === 0}
              onClick={markAll}
            >
              <CheckCheck className="size-3.5" aria-hidden />
              <T k="inbox.markAll" />
            </Button>
          </div>
        </div>

        {inbox.isPending ? (
          <div className="space-y-3" aria-hidden>
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : inbox.isError ? (
          <Card>
            <CardContent role="alert" className="py-10 text-center text-sm text-destructive">
              <T k="inbox.loadError" />
            </CardContent>
          </Card>
        ) : items.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Inbox className="size-4 text-brand-strong" aria-hidden />
                <T k="inbox.allCaughtUp" />
              </CardTitle>
              <CardDescription><T k="inbox.newUpdates" /></CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <ul className="space-y-3">
            {items.map((item) => {
              const title = item.link.startsWith("/") ? (
                <Link href={item.link} className="hover:underline">{item.title}</Link>
              ) : (
                item.title
              );
              return (
                <li key={item.id}>
                  <Card size="sm" className={item.state === "new" ? "border-l-2 border-l-brand" : ""}>
                    <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium">{title}</p>
                          {item.state === "new" ? (
                            <Badge variant="secondary"><T k="inbox.new" /></Badge>
                          ) : null}
                        </div>
                        {item.body ? (
                          <p className="text-sm text-muted-foreground">{item.body}</p>
                        ) : null}
                        <p className="text-xs text-muted-foreground">
                          {formatDate(item.created.slice(0, 10))}
                        </p>
                      </div>
                      {item.state === "new" ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-9 rounded-xl"
                          disabled={mark.isPending}
                          onClick={() => markOne(item.id)}
                        >
                          <Check className="size-3.5" aria-hidden />
                          <T k="inbox.markRead" />
                        </Button>
                      ) : (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Check className="size-3.5" aria-hidden />
                          <T k="inbox.read" />
                        </span>
                      )}
                    </CardContent>
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </ClientGate>
  );
}
