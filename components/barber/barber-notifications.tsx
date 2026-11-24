"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "sonner";
import {
  useBarberNotifications,
  useMarkAllBarberNotifications,
  useMarkBarberNotification,
} from "@/lib/api/barber-queries";
import { formatDate } from "@/lib/domain/time";

import { Empty, FormError, LoadingRows, message } from "./barber-ui";

export function BarberNotifications() {
  const inbox = useBarberNotifications();
  const mark = useMarkBarberNotification();
  const markAll = useMarkAllBarberNotifications();
  const notifications = inbox.data ?? [];
  const unread = notifications.filter((item) => item.state !== "read").length;

  return (
    <Card className="glass">
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
        <div>
          <CardTitle>Inbox</CardTitle>
          <CardDescription>
            {unread} unread · {notifications.length} notifications.
          </CardDescription>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={unread === 0 || markAll.isPending}
          onClick={() =>
            markAll.mutate(undefined, {
              onSuccess: () => toast.success("All marked as read"),
              onError: (error) => toast.error(message(error, "Could not update your inbox.")),
            })
          }
        >
          Mark all as read
        </Button>
      </CardHeader>
      <CardContent>
        {inbox.isPending ? (
          <LoadingRows />
        ) : inbox.isError ? (
          <FormError text={message(inbox.error, "Could not load your inbox.")} />
        ) : notifications.length === 0 ? (
          <Empty>Your inbox is empty.</Empty>
        ) : (
          <ul className="space-y-3">
            {notifications.map((item) => (
              <li
                key={item.id}
                className={`flex flex-wrap items-start justify-between gap-3 rounded-xl border p-4 ${
                  item.state === "read" ? "border-border" : "border-brand/40 bg-brand/10"
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">{item.title}</span>
                    {item.state !== "read" ? (
                      <span className="rounded-full bg-brand px-2 py-0.5 text-xs text-brand-foreground">New</span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{item.body || "—"}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{formatDate(item.created.slice(0, 10))}</p>
                </div>
                {item.state !== "read" ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={mark.isPending}
                    onClick={() =>
                      mark.mutate(item.id, {
                        onSuccess: () => toast.success("Marked as read"),
                        onError: (error) => toast.error(message(error, "Could not update the notification.")),
                      })
                    }
                  >
                    Mark read
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
