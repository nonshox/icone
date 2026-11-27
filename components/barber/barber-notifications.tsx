"use client";

import { T } from "@/components/i18n/t";
import { useT } from "@/lib/i18n/use-t";
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
  const t = useT();
  const notifications = inbox.data ?? [];
  const unread = notifications.filter((item) => item.state === "new").length;

  return (
    <Card className="glass">
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
        <div>
          <CardTitle>
            <T k="nav.inbox" />
          </CardTitle>
          <CardDescription>
            {unread} <T k="work.inbox.unread" /> · {notifications.length}{" "}
            <T k="nav.inbox" />
          </CardDescription>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={unread === 0 || markAll.isPending}
          onClick={() =>
            markAll.mutate(undefined, {
              onSuccess: () => toast.success(t("work.inbox.toastAll")),
              onError: (error) =>
                toast.error(message(error, t("work.toast.failed"))),
            })
          }
        >
          <T k="work.inbox.markAll" />
        </Button>
      </CardHeader>
      <CardContent>
        {inbox.isPending ? (
          <LoadingRows />
        ) : inbox.isError ? (
          <FormError text={message(inbox.error, t("work.loadError"))} />
        ) : notifications.length === 0 ? (
          <Empty>{t("work.inbox.empty")}</Empty>
        ) : (
          <ul className="space-y-3">
            {notifications.map((item) => (
              <li
                key={item.id}
                className={`flex flex-wrap items-start justify-between gap-3 rounded-xl border p-4 ${
                  item.state === "read"
                    ? "border-border"
                    : "border-brand/40 bg-brand/10"
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">{item.title}</span>
                    {item.state === "new" ? (
                      <span className="rounded-full bg-brand px-2 py-0.5 text-xs text-brand-foreground">
                        <T k="work.inbox.new" />
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {item.body || "—"}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {item.created ? formatDate(item.created.slice(0, 10)) : "—"}
                  </p>
                </div>
                {item.state === "new" && item.link ? (
                  <a
                    href={item.link}
                    className="text-sm font-medium text-brand-strong hover:underline"
                  >
                    <T k="common.view" />
                  </a>
                ) : null}
                {item.state === "new" ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={mark.isPending}
                    onClick={() =>
                      mark.mutate(item.id, {
                        onSuccess: () =>
                          toast.success(t("work.inbox.toastOne")),
                        onError: (error) =>
                          toast.error(
                            message(error, t("work.toast.failed")),
                          ),
                      })
                    }
                  >
                    <T k="work.inbox.markRead" />
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
