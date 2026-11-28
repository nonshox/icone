"use client";

import { Fragment, useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Textarea } from "@/components/ui/textarea";
import { T } from "@/components/i18n/t";
import { imageUrl } from "@/lib/client/files";
import { useT } from "@/lib/i18n/use-t";
import {
  useAdminAnnouncements,
  useAdminBarbers,
  useAdminPortfolio,
  useAdminReviews,
  useDeletePortfolioItem,
  useDeleteReview,
  useSendAnnouncement,
  type AdminReview,
  type Audience,
} from "@/lib/api/admin-queries";
import {
  useAdminAudit,
  useAdminReports,
  useAdminSettings,
  useAdminTickets,
  useResolveReport,
  useTicketClose,
  useTicketReply,
  useUpdateAdminSettings,
  type AuditFilter,
  type PlatformSettings,
  type ReportState,
  type TicketState,
} from "@/lib/api/platform-queries";

import { Empty, FormError, LoadingRows, Section, message } from "./admin-ui";

function StateBadge({ state }: { state: string }) {
  const t = useT();
  const label = t(`padmin.state.${state}`);
  const variant: "outline" | "secondary" | "destructive" =
    state === "resolved" || state === "answered"
      ? "secondary"
      : state === "rejected" || state === "closed"
        ? "destructive"
        : "outline";
  return <Badge variant={variant}>{label.startsWith("padmin.state.") ? state : label}</Badge>;
}

/* ---------------------------------------------------------------- reports */

function ReportQueue() {
  const t = useT();
  const [filter, setFilter] = useState<"all" | ReportState>("all");
  const reports = useAdminReports(filter === "all" ? undefined : filter);
  const resolve = useResolveReport();

  const [activeId, setActiveId] = useState<string | null>(null);
  const [targetState, setTargetState] = useState<ReportState>("resolved");
  const [detail, setDetail] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const rows = reports.data ?? [];
  const busy = resolve.isPending;

  function open(id: string, state: ReportState) {
    if (state === "rejected" && !window.confirm(t("padmin.reports.confirmReject"))) return;
    setActiveId(id);
    setTargetState(state);
    setDetail("");
    setFormError(null);
  }

  function submit(event: FormEvent<HTMLFormElement>, id: string) {
    event.preventDefault();
    if (!detail.trim()) {
      setFormError(t("padmin.reports.detailRequired"));
      return;
    }
    setFormError(null);
    resolve.mutate(
      { id, state: targetState, detail },
      {
        onSuccess: () => {
          setActiveId(null);
          setDetail("");
          toast.success(
            t(targetState === "rejected" ? "padmin.reports.rejected" : "padmin.reports.resolved"),
          );
        },
        onError: (cause) => {
          const text = message(cause, t("admin.saveError"));
          setFormError(text);
          toast.error(text);
        },
      },
    );
  }

  return (
    <Section title={<T k="padmin.reports.title" />} description={<T k="padmin.reports.desc" />}>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="report-state"><T k="padmin.reports.filter" /></Label>
          <Select value={filter} onValueChange={(value) => setFilter(value as "all" | ReportState)}>
            <SelectTrigger id="report-state" className="h-9 w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all"><T k="padmin.state.all" /></SelectItem>
              <SelectItem value="open"><T k="padmin.state.open" /></SelectItem>
              <SelectItem value="review"><T k="padmin.state.review" /></SelectItem>
              <SelectItem value="resolved"><T k="padmin.state.resolved" /></SelectItem>
              <SelectItem value="rejected"><T k="padmin.state.rejected" /></SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <FormError
        text={formError ?? (reports.error ? message(reports.error, t("admin.loadError")) : null)}
      />

      {reports.isPending ? (
        <LoadingRows />
      ) : rows.length === 0 ? (
        <Empty><T k="padmin.reports.empty" /></Empty>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead><T k="padmin.reports.reporter" /></TableHead>
                <TableHead><T k="padmin.reports.kind" /></TableHead>
                <TableHead><T k="padmin.reports.target" /></TableHead>
                <TableHead><T k="padmin.reports.note" /></TableHead>
                <TableHead><T k="common.status" /></TableHead>
                <TableHead><T k="common.date" /></TableHead>
                <TableHead className="text-right"><T k="admin.actions" /></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((report) => (
                <Fragment key={report.id}>
                  <TableRow>
                    <TableCell className="font-mono text-xs">{report.reporter.slice(0, 10) || "—"}</TableCell>
                    <TableCell>{report.kind}</TableCell>
                    <TableCell className="max-w-48 truncate font-mono text-xs">
                      {report.target || "—"}
                    </TableCell>
                    <TableCell className="max-w-72 whitespace-normal text-muted-foreground">
                      {report.note || "—"}
                      {report.detail ? (
                        <span className="block text-xs">· {report.detail}</span>
                      ) : null}
                    </TableCell>
                    <TableCell><StateBadge state={report.state} /></TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {report.created.slice(0, 10)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex flex-wrap justify-end gap-2">
                        {(report.state === "open" || report.state === "review") ? (
                          <>
                            <Button
                              type="button"
                              size="xs"
                              variant="outline"
                              disabled={busy}
                              onClick={() => open(report.id, "resolved")}
                            >
                              <T k="padmin.reports.resolve" />
                            </Button>
                            <Button
                              type="button"
                              size="xs"
                              variant="destructive"
                              disabled={busy}
                              onClick={() => open(report.id, "rejected")}
                            >
                              <T k="padmin.reports.reject" />
                            </Button>
                          </>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                  {activeId === report.id ? (
                    <TableRow>
                      <TableCell colSpan={7}>
                        <form
                          onSubmit={(event) => submit(event, report.id)}
                          className="space-y-2 rounded-lg border bg-muted/30 p-3"
                        >
                          <Label htmlFor={`report-detail-${report.id}`}>
                            <T k="padmin.reports.detail" />
                          </Label>
                          <Textarea
                            id={`report-detail-${report.id}`}
                            value={detail}
                            maxLength={512}
                            placeholder={t("padmin.reports.detailHint")}
                            onChange={(event) => setDetail(event.target.value)}
                          />
                          <div className="flex flex-wrap gap-2">
                            <Button type="submit" size="sm" disabled={busy}>
                              {busy ? <T k="common.loading" /> : <T k="common.save" />}
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={busy}
                              onClick={() => setActiveId(null)}
                            >
                              <T k="common.cancel" />
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

/* ---------------------------------------------------------------- tickets */

function TicketQueue() {
  const t = useT();
  const [filter, setFilter] = useState<"all" | TicketState>("all");
  const tickets = useAdminTickets(filter === "all" ? undefined : filter);
  const reply = useTicketReply();
  const close = useTicketClose();

  const [activeId, setActiveId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const rows = tickets.data ?? [];
  const busy = reply.isPending || close.isPending;

  function send(event: FormEvent<HTMLFormElement>, id: string) {
    event.preventDefault();
    if (!replyText.trim()) {
      setFormError(t("padmin.tickets.replyRequired"));
      return;
    }
    setFormError(null);
    reply.mutate(
      { id, action: "reply", reply: replyText },
      {
        onSuccess: () => {
          setActiveId(null);
          setReplyText("");
          toast.success(t("padmin.tickets.replied"));
        },
        onError: (cause) => {
          const text = message(cause, t("admin.saveError"));
          setFormError(text);
          toast.error(text);
        },
      },
    );
  }

  return (
    <Section title={<T k="padmin.tickets.title" />} description={<T k="padmin.tickets.desc" />}>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="ticket-state"><T k="padmin.reports.filter" /></Label>
          <Select value={filter} onValueChange={(value) => setFilter(value as "all" | TicketState)}>
            <SelectTrigger id="ticket-state" className="h-9 w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all"><T k="padmin.state.all" /></SelectItem>
              <SelectItem value="open"><T k="padmin.state.open" /></SelectItem>
              <SelectItem value="answered"><T k="padmin.state.answered" /></SelectItem>
              <SelectItem value="closed"><T k="padmin.state.closed" /></SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <FormError
        text={formError ?? (tickets.error ? message(tickets.error, t("admin.loadError")) : null)}
      />

      {tickets.isPending ? (
        <LoadingRows />
      ) : rows.length === 0 ? (
        <Empty><T k="padmin.tickets.empty" /></Empty>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead><T k="padmin.tickets.user" /></TableHead>
                <TableHead><T k="padmin.tickets.topic" /></TableHead>
                <TableHead><T k="padmin.tickets.body" /></TableHead>
                <TableHead><T k="common.status" /></TableHead>
                <TableHead><T k="common.date" /></TableHead>
                <TableHead className="text-right"><T k="admin.actions" /></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((ticket) => (
                <Fragment key={ticket.id}>
                  <TableRow>
                    <TableCell className="font-mono text-xs">{ticket.user.slice(0, 10) || "—"}</TableCell>
                    <TableCell className="font-medium">{ticket.topic}</TableCell>
                    <TableCell className="max-w-72 whitespace-normal text-muted-foreground">
                      {ticket.body}
                      {ticket.reply ? (
                        <span className="block text-xs">↳ {ticket.reply}</span>
                      ) : null}
                    </TableCell>
                    <TableCell><StateBadge state={ticket.state} /></TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {ticket.created.slice(0, 10)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex flex-wrap justify-end gap-2">
                        {ticket.state !== "closed" ? (
                          <>
                            <Button
                              type="button"
                              size="xs"
                              variant="outline"
                              disabled={busy}
                              onClick={() => {
                                setActiveId(activeId === ticket.id ? null : ticket.id);
                                setReplyText(ticket.reply);
                                setFormError(null);
                              }}
                            >
                              <T k="padmin.tickets.replyLabel" />
                            </Button>
                            <Button
                              type="button"
                              size="xs"
                              variant="destructive"
                              disabled={busy}
                              onClick={() => {
                                if (!window.confirm(t("padmin.tickets.confirmClose"))) return;
                                close.mutate(
                                  { id: ticket.id, action: "close" },
                                  {
                                    onSuccess: () => {
                                      setActiveId(null);
                                      toast.success(t("padmin.tickets.closed"));
                                    },
                                    onError: (cause) =>
                                      toast.error(message(cause, t("admin.saveError"))),
                                  },
                                );
                              }}
                            >
                              <T k="padmin.tickets.close" />
                            </Button>
                          </>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                  {activeId === ticket.id && ticket.state !== "closed" ? (
                    <TableRow>
                      <TableCell colSpan={6}>
                        <form
                          onSubmit={(event) => send(event, ticket.id)}
                          className="space-y-2 rounded-lg border bg-muted/30 p-3"
                        >
                          <Label htmlFor={`ticket-reply-${ticket.id}`}>
                            <T k="padmin.tickets.replyLabel" />
                          </Label>
                          <Textarea
                            id={`ticket-reply-${ticket.id}`}
                            value={replyText}
                            maxLength={1024}
                            placeholder={t("padmin.tickets.replyPlaceholder")}
                            onChange={(event) => setReplyText(event.target.value)}
                          />
                          <div className="flex flex-wrap gap-2">
                            <Button type="submit" size="sm" disabled={busy}>
                              {busy ? <T k="common.loading" /> : <T k="padmin.tickets.reply" />}
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={busy}
                              onClick={() => setActiveId(null)}
                            >
                              <T k="common.cancel" />
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

/* ---------------------------------------------------------------- settings */

type SettingsDraft = {
  applicationsOpen: boolean;
  autoVerify: boolean;
  notice: string;
};

function draftFor(settings: PlatformSettings): SettingsDraft {
  return {
    applicationsOpen: settings.applicationsOpen,
    autoVerify: settings.autoVerify,
    notice: settings.notice,
  };
}

function SettingsFields({ settings }: { settings: PlatformSettings }) {
  const t = useT();
  const update = useUpdateAdminSettings();
  const [draft, setDraft] = useState<SettingsDraft>(() => draftFor(settings));
  const [formError, setFormError] = useState<string | null>(null);

  function patch<K extends keyof SettingsDraft>(key: K, value: SettingsDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    update.mutate(
      {
        applicationsOpen: draft.applicationsOpen,
        autoVerify: draft.autoVerify,
        notice: draft.notice,
      },
      {
        onSuccess: () => toast.success(t("padmin.settings.saved")),
        onError: (cause) => {
          const text = message(cause, t("admin.saveError"));
          setFormError(text);
          toast.error(text);
        },
      },
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex items-center gap-2 rounded-lg border px-3 py-2">
          <Checkbox
            id="settings-applications"
            checked={draft.applicationsOpen}
            onCheckedChange={(value) => patch("applicationsOpen", value === true)}
          />
          <Label htmlFor="settings-applications" className="cursor-pointer">
            <T k="padmin.settings.applicationsOpen" />
          </Label>
        </div>
        <div className="flex items-center gap-2 rounded-lg border px-3 py-2">
          <Checkbox
            id="settings-autoverify"
            checked={draft.autoVerify}
            onCheckedChange={(value) => patch("autoVerify", value === true)}
          />
          <Label htmlFor="settings-autoverify" className="cursor-pointer">
            <T k="padmin.settings.autoVerify" />
          </Label>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="settings-notice"><T k="padmin.settings.notice" /></Label>
        <Textarea
          id="settings-notice"
          value={draft.notice}
          maxLength={512}
          onChange={(event) => patch("notice", event.target.value)}
        />
        <p className="text-xs text-muted-foreground"><T k="padmin.settings.noticeHint" /></p>
      </div>

      <FormError text={formError} />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={update.isPending}>
          {update.isPending ? <T k="common.loading" /> : <T k="common.save" />}
        </Button>
      </div>
    </form>
  );
}

function PlatformSettingsForm() {
  const t = useT();
  const query = useAdminSettings();

  return (
    <Section title={<T k="padmin.settings.title" />} description={<T k="padmin.settings.desc" />}>
      {query.isPending ? (
        <LoadingRows />
      ) : query.isError || !query.data ? (
        <FormError text={message(query.error, t("admin.loadError"))} />
      ) : (
        <SettingsFields key={JSON.stringify(query.data)} settings={query.data} />
      )}
    </Section>
  );
}

/* ------------------------------------------------------------------- audit */

function AuditPanel() {
  const t = useT();
  const [action, setAction] = useState("");
  const [actor, setActor] = useState("");
  const [kind, setKind] = useState("");
  const [target, setTarget] = useState("");
  const [limit, setLimit] = useState(50);

  const filter = useMemo<AuditFilter>(
    () => ({
      action: action || undefined,
      actor: actor || undefined,
      kind: kind || undefined,
      target: target || undefined,
      limit,
    }),
    [action, actor, kind, target, limit],
  );
  const query = useAdminAudit(filter);
  const rows = query.data?.entries ?? [];
  const actions = query.data?.actions ?? [];

  return (
    <Section title={<T k="padmin.audit.title" />} description={<T k="padmin.audit.desc" />}>
      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="audit-action"><T k="padmin.audit.action" /></Label>
          <Select value={action || "all"} onValueChange={(value) => setAction(value === "all" || !value ? "" : value)}>
            <SelectTrigger id="audit-action" className="h-9 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all"><T k="padmin.audit.allActions" /></SelectItem>
              {actions.map((item) => (
                <SelectItem key={item} value={item}>{item}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="audit-actor"><T k="padmin.audit.actor" /></Label>
          <Input
            id="audit-actor"
            value={actor}
            maxLength={36}
            onChange={(event) => setActor(event.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="audit-kind"><T k="padmin.audit.kind" /></Label>
          <Input
            id="audit-kind"
            value={kind}
            maxLength={24}
            onChange={(event) => setKind(event.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="audit-target"><T k="padmin.audit.target" /></Label>
          <Input
            id="audit-target"
            value={target}
            maxLength={36}
            onChange={(event) => setTarget(event.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="audit-limit"><T k="padmin.audit.limit" /></Label>
          <Select value={String(limit)} onValueChange={(value) => setLimit(Number(value))}>
            <SelectTrigger id="audit-limit" className="h-9 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="20">20</SelectItem>
              <SelectItem value="50">50</SelectItem>
              <SelectItem value="100">100</SelectItem>
              <SelectItem value="200">200</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <FormError text={query.error ? message(query.error, t("admin.loadError")) : null} />

      {query.isPending ? (
        <LoadingRows />
      ) : rows.length === 0 ? (
        <Empty><T k="padmin.audit.empty" /></Empty>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead><T k="padmin.audit.at" /></TableHead>
                <TableHead><T k="padmin.audit.actor" /></TableHead>
                <TableHead><T k="padmin.audit.action" /></TableHead>
                <TableHead><T k="padmin.audit.kind" /></TableHead>
                <TableHead><T k="padmin.audit.target" /></TableHead>
                <TableHead><T k="padmin.audit.detail" /></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                    {entry.at.slice(0, 16).replace("T", " ")}
                  </TableCell>
                  <TableCell className="font-mono text-xs">{entry.actor.slice(0, 10) || "—"}</TableCell>
                  <TableCell className="text-xs">{entry.action}</TableCell>
                  <TableCell className="text-xs">{entry.kind || "—"}</TableCell>
                  <TableCell className="max-w-40 truncate font-mono text-xs">
                    {entry.target || "—"}
                  </TableCell>
                  <TableCell className="max-w-72 whitespace-normal text-xs text-muted-foreground">
                    {entry.detail || "—"}
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

/* -------------------------------------------------------------- page view  */

export function ModerationView() {
  const t = useT();
  const reviews = useAdminReviews();
  const removeReview = useDeleteReview();
  const portfolio = useAdminPortfolio();
  const barbers = useAdminBarbers();
  const removeImage = useDeletePortfolioItem();
  const announcements = useAdminAnnouncements();
  const send = useSendAnnouncement();

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [errorText, setErrorText] = useState<string | null>(null);

  // The platform has one site-wide notice; no narrower audience exists.
  const audience: Audience = "all";

  const reviewRows = (reviews.data ?? []) as Array<AdminReview & { userName?: string }>;
  const chairNames = new Map((barbers.data ?? []).map((item) => [item.id, item.name]));

  const error =
    errorText ??
    (reviews.error ? message(reviews.error, t("admin.loadError")) : null) ??
    (portfolio.error ? message(portfolio.error, t("admin.loadError")) : null) ??
    (announcements.error ? message(announcements.error, t("admin.loadError")) : null);

  function broadcast(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!title.trim() || !body.trim()) {
      setErrorText(t("admin.noticeRequired"));
      return;
    }
    setErrorText(null);
    send.mutate(
      { title, body, audience },
      {
        onSuccess: () => {
          toast.success(t("admin.noticeSaved"));
          setTitle("");
          setBody("");
        },
        onError: (cause) => {
          const text = message(cause, t("admin.saveError"));
          setErrorText(text);
          toast.error(text);
        },
      },
    );
  }

  return (
    <div className="space-y-6">
      <div id="reports" className="scroll-mt-4">
        <ReportQueue />
      </div>

      <div id="tickets" className="scroll-mt-4">
        <TicketQueue />
      </div>

      <PlatformSettingsForm />
      <AuditPanel />

      <Section title={<T k="admin.reviews" />} description={<T k="admin.reviewsDesc" />}>
        <FormError text={error} />
        {reviews.isPending ? (
          <LoadingRows />
        ) : reviewRows.length === 0 ? (
          <Empty><T k="admin.noReviews" /></Empty>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead><T k="common.member" /></TableHead>
                  <TableHead><T k="admin.chair" /></TableHead>
                  <TableHead><T k="admin.rating" /></TableHead>
                  <TableHead><T k="common.note" /></TableHead>
                  <TableHead><T k="common.date" /></TableHead>
                  <TableHead className="text-right"><T k="admin.actions" /></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reviewRows.map((review) => (
                  <TableRow key={review.id}>
                    <TableCell className="font-mono text-xs">
                      {review.userName || review.user.slice(0, 10)}
                    </TableCell>
                    <TableCell>{chairNames.get(review.barber) ?? review.barber.slice(0, 8)}</TableCell>
                    <TableCell className="tabular-nums">{review.rate}/5</TableCell>
                    <TableCell className="max-w-72 whitespace-normal">
                      {review.note || "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {review.created.slice(0, 10)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        type="button"
                        size="xs"
                        variant="destructive"
                        disabled={removeReview.isPending}
                        onClick={() => {
                          if (!window.confirm(t("admin.confirmRemoveReview"))) return;
                          removeReview.mutate(review.id, {
                            onSuccess: () => toast.success(t("admin.removed")),
                            onError: (cause) =>
                              toast.error(message(cause, t("admin.saveError"))),
                          });
                        }}
                      >
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

      <Section title={<T k="admin.portfolio" />} description={<T k="admin.portfolioDesc" />}>
        {portfolio.isPending ? (
          <LoadingRows />
        ) : (portfolio.data ?? []).length === 0 ? (
          <Empty><T k="admin.noPortfolio" /></Empty>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead><T k="common.name" /></TableHead>
                  <TableHead><T k="admin.image" /></TableHead>
                  <TableHead><T k="common.note" /></TableHead>
                  <TableHead className="text-right"><T k="admin.actions" /></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(portfolio.data ?? []).map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{chairNames.get(item.barber) ?? item.barber}</TableCell>
                    <TableCell className="max-w-72 truncate">
                      <a
                        href={imageUrl(item.url)}
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary underline underline-offset-2"
                      >
                        {item.url}
                      </a>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{item.note || "—"}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        type="button"
                        size="xs"
                        variant="destructive"
                        disabled={removeImage.isPending}
                        onClick={() => {
                          if (!window.confirm(t("admin.confirmRemoveImage"))) return;
                          removeImage.mutate(item.id, {
                            onSuccess: () => toast.success(t("admin.removed")),
                            onError: (cause) =>
                              toast.error(message(cause, t("admin.saveError"))),
                          });
                        }}
                      >
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

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title={<T k="admin.notice" />} description={<T k="admin.noticeDesc" />}>
          <form onSubmit={broadcast} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="announce-title"><T k="common.name" /></Label>
              <Input
                id="announce-title"
                value={title}
                maxLength={96}
                onChange={(event) => setTitle(event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="announce-body"><T k="common.note" /></Label>
              <Textarea
                id="announce-body"
                value={body}
                maxLength={512}
                onChange={(event) => setBody(event.target.value)}
              />
            </div>
            <p className="text-xs text-muted-foreground"><T k="admin.noticeAudienceHint" /></p>
            <Button type="submit" disabled={send.isPending}>
              {send.isPending ? <T k="admin.sending" /> : <T k="admin.sendNotice" />}
            </Button>
          </form>
        </Section>

        <Section title={<T k="admin.recentNotices" />}>
          {announcements.isPending ? (
            <LoadingRows />
          ) : (announcements.data ?? []).length === 0 ? (
            <Empty><T k="admin.noAnnouncements" /></Empty>
          ) : (
            <ul className="divide-y">
              {(announcements.data ?? []).map((item, index) => (
                <li key={`${item.title}-${index}`} className="py-2">
                  <p className="text-sm font-medium">{item.title}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {item.body} {item.created ? `· ${item.created.slice(0, 10)}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>
    </div>
  );
}
