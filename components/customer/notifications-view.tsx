"use client";

import { Check, CheckCheck, Inbox } from "lucide-react";
import { toast } from "sonner";

import { ClientGate } from "@/components/customer/client-gate";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useMarkNotificationRead, useNotifications } from "@/lib/api/customer-queries";
import { formatDate } from "@/lib/domain/time";
import type { Profile } from "@/lib/domain/types";

export function NotificationsView({ profile }: { profile: Profile }) {
  const inbox = useNotifications();
  const mark = useMarkNotificationRead();

  function markOne(id: string) {
    mark.mutate(
      { id },
      {
        onSuccess: () => toast.success("Marked as read"),
        onError: (error) =>
          toast.error("Could not update", {
            description: error instanceof Error ? error.message : "Please try again.",
          }),
      },
    );
  }

  function markAll() {
    mark.mutate(
      { all: true },
      {
        onSuccess: () => toast.success("Inbox cleared"),
        onError: (error) =>
          toast.error("Could not update", {
            description: error instanceof Error ? error.message : "Please try again.",
          }),
      },
    );
  }

  const items = inbox.data?.notifications ?? [];
  const unread = inbox.data?.unread ?? 0;

  return (
    <ClientGate role={profile.role}>
      <div className="space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-medium tracking-[0.18em] text-brand-strong uppercase">
              Inbox
            </p>
          </div>
          <div className="flex items-center gap-3">
            {unread > 0 ? (
              <Badge variant="secondary" className="tabular-nums">
                {unread} unread
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
              Mark all read
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
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              Could not load your inbox. Refresh the page to try again.
            </CardContent>
          </Card>
        ) : items.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Inbox className="size-4 text-brand-strong" aria-hidden />
                All caught up
              </CardTitle>
              <CardDescription>New updates appear here.</CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <ul className="space-y-3">
            {items.map((item) => (
              <li key={item.id}>
                <Card size="sm" className={item.state === "unread" ? "border-l-2 border-l-brand" : ""}>
                  <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">{item.title}</p>
                        {item.state === "unread" ? (
                          <Badge variant="secondary">New</Badge>
                        ) : null}
                      </div>
                      {item.body ? (
                        <p className="text-sm text-muted-foreground">{item.body}</p>
                      ) : null}
                      <p className="text-xs text-muted-foreground">
                        {formatDate(item.created.slice(0, 10))}
                      </p>
                    </div>
                    {item.state === "unread" ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-9 rounded-xl"
                        disabled={mark.isPending}
                        onClick={() => markOne(item.id)}
                      >
                        <Check className="size-3.5" aria-hidden />
                        Mark read
                      </Button>
                    ) : (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Check className="size-3.5" aria-hidden />
                        Read
                      </span>
                    )}
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </div>
    </ClientGate>
  );
}
