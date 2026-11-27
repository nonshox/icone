"use client";

import { Fragment, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  useApplications,
  useDecideApplication,
  type Application,
} from "@/lib/api/application-queries";

import { Empty, FormError, LoadingRows, Section, message } from "./admin-ui";

export function ApplicationsView() {
  const t = useT();
  const list = useApplications();
  const decide = useDecideApplication();
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [openId, setOpenId] = useState<string | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);

  function act(item: Application, decision: "approved" | "rejected") {
    setErrorText(null);
    decide.mutate(
      { id: item.id, decision, note: notes[item.id] ?? "" },
      {
        onSuccess: () =>
          toast.success(decision === "approved" ? t("admin.approved") : t("admin.rejected")),
        onError: (cause) => {
          const text = message(cause, t("admin.saveError"));
          setErrorText(text);
          toast.error(text);
        },
      },
    );
  }

  const error = errorText ?? (list.error ? message(list.error, t("admin.loadError")) : null);

  return (
    <Section title={<T k="admin.applications.title" />} description={<T k="admin.applications.description" />}>
      <FormError text={error} />
      {list.isPending ? (
        <LoadingRows />
      ) : (list.data ?? []).length === 0 ? (
        <Empty><T k="admin.noApplications" /></Empty>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead><T k="common.name" /></TableHead>
                <TableHead><T k="admin.shop" /></TableHead>
                <TableHead><T k="admin.city" /></TableHead>
                <TableHead><T k="common.status" /></TableHead>
                <TableHead className="text-right"><T k="admin.actions" /></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(list.data ?? []).map((item) => (
                <Fragment key={item.id}>
                  <TableRow>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell>{item.shop || "—"}</TableCell>
                    <TableCell>{item.city || "—"}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          item.state === "approved"
                            ? "secondary"
                            : item.state === "rejected"
                              ? "destructive"
                              : "outline"
                        }
                      >
                        {item.state === "approved"
                          ? t("admin.approved")
                          : item.state === "rejected"
                            ? t("admin.rejected")
                            : t("status.pending")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex flex-wrap justify-end gap-2">
                        <Button
                          type="button"
                          size="xs"
                          variant="outline"
                          onClick={() => setOpenId(openId === item.id ? null : item.id)}
                        >
                          {openId === item.id ? <T k="common.close" /> : <T k="admin.details" />}
                        </Button>
                        {["submitted", "review", "info"].includes(item.state) ? (
                          <>
                            <Input
                              aria-label={t("admin.appNote")}
                              value={notes[item.id] ?? ""}
                              maxLength={512}
                              placeholder={t("admin.appNote")}
                              className="h-8 w-32"
                              onChange={(event) =>
                                setNotes((current) => ({ ...current, [item.id]: event.target.value }))
                              }
                            />
                            <Button
                              type="button"
                              size="xs"
                              disabled={decide.isPending}
                              onClick={() => act(item, "approved")}
                            >
                              <T k="admin.approve" />
                            </Button>
                            <Button
                              type="button"
                              size="xs"
                              variant="destructive"
                              disabled={decide.isPending}
                              onClick={() => act(item, "rejected")}
                            >
                              <T k="admin.reject" />
                            </Button>
                          </>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            {item.note || "—"}
                          </span>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                  {openId === item.id ? (
                    <TableRow>
                      <TableCell colSpan={5}>
                        <dl className="grid gap-2 rounded-lg border bg-muted/30 p-3 text-sm sm:grid-cols-2">
                          <div>
                            <dt className="text-xs text-muted-foreground"><T k="common.phone" /></dt>
                            <dd>{item.phone || "—"}</dd>
                          </div>
                          <div>
                            <dt className="text-xs text-muted-foreground"><T k="admin.address" /></dt>
                            <dd>{item.address || "—"}</dd>
                          </div>
                          <div>
                            <dt className="text-xs text-muted-foreground"><T k="admin.bio" /></dt>
                            <dd>{item.bio || "—"}</dd>
                          </div>
                          <div>
                            <dt className="text-xs text-muted-foreground"><T k="common.date" /></dt>
                            <dd>{item.created.slice(0, 10)}</dd>
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
