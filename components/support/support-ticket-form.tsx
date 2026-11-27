"use client";

import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { T } from "@/components/i18n/t";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useT } from "@/lib/i18n/use-t";
import {
  useCreateReport,
  useCreateTicket,
  type NewReport,
  type ReportKind,
} from "@/lib/api/platform-queries";

const KINDS: ReportKind[] = ["user", "barber", "business", "booking", "review", "other"];

function errorText(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

export function SupportTicketForm() {
  const t = useT();
  const ticket = useCreateTicket();
  const report = useCreateReport();

  const [topic, setTopic] = useState("");
  const [body, setBody] = useState("");
  const [ticketError, setTicketError] = useState<string | null>(null);
  const [ticketDone, setTicketDone] = useState(false);

  const [kind, setKind] = useState<ReportKind>("booking");
  const [target, setTarget] = useState("");
  const [note, setNote] = useState("");
  const [reportError, setReportError] = useState<string | null>(null);
  const [reportDone, setReportDone] = useState(false);

  function submitTicket(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!topic.trim() || !body.trim()) {
      setTicketError(t("support.ticket.required"));
      return;
    }
    setTicketError(null);
    setTicketDone(false);
    ticket.mutate(
      { topic, body },
      {
        onSuccess: () => {
          setTopic("");
          setBody("");
          setTicketDone(true);
          toast.success(t("support.ticket.success"));
        },
        onError: (cause) => {
          const text = errorText(cause, t("support.ticket.error"));
          setTicketError(text);
          toast.error(text);
        },
      },
    );
  }

  function submitReport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!target.trim() || !note.trim()) {
      setReportError(t("support.report.required"));
      return;
    }
    setReportError(null);
    setReportDone(false);
    const input: NewReport = { kind, target, note };
    report.mutate(input, {
      onSuccess: () => {
        setTarget("");
        setNote("");
        setReportDone(true);
        toast.success(t("support.report.success"));
      },
      onError: (cause) => {
        const text = errorText(cause, t("support.report.error"));
        setReportError(text);
        toast.error(text);
      },
    });
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Card size="sm" className="h-full">
        <CardHeader>
          <CardTitle><T k="support.ticket.title" /></CardTitle>
          <CardDescription><T k="support.ticket.desc" /></CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submitTicket} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="support-topic"><T k="support.ticket.topic" /></Label>
              <Input
                id="support-topic"
                value={topic}
                maxLength={64}
                placeholder={t("support.ticket.topicHint")}
                onChange={(event) => setTopic(event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="support-body"><T k="support.ticket.body" /></Label>
              <Textarea
                id="support-body"
                value={body}
                maxLength={1024}
                placeholder={t("support.ticket.bodyHint")}
                onChange={(event) => setBody(event.target.value)}
              />
            </div>
            {ticketError ? (
              <p role="alert" className="text-sm text-destructive">{ticketError}</p>
            ) : null}
            {ticketDone ? (
              <p role="status" className="text-sm text-primary">
                <T k="support.ticket.success" />
              </p>
            ) : null}
            <Button type="submit" disabled={ticket.isPending}>
              {ticket.isPending ? <T k="support.ticket.sending" /> : <T k="support.ticket.submit" />}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card size="sm" className="h-full">
        <CardHeader>
          <CardTitle><T k="support.report.title" /></CardTitle>
          <CardDescription><T k="support.report.desc" /></CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submitReport} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="report-kind"><T k="support.report.kind" /></Label>
              <Select value={kind} onValueChange={(value) => setKind(value as ReportKind)}>
                <SelectTrigger id="report-kind" className="h-9 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {KINDS.map((item) => (
                    <SelectItem key={item} value={item}>
                      {t(`support.kind.${item}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="report-target"><T k="support.report.target" /></Label>
              <Input
                id="report-target"
                value={target}
                maxLength={36}
                onChange={(event) => setTarget(event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="report-note"><T k="support.report.note" /></Label>
              <Textarea
                id="report-note"
                value={note}
                maxLength={512}
                onChange={(event) => setNote(event.target.value)}
              />
            </div>
            {reportError ? (
              <p role="alert" className="text-sm text-destructive">{reportError}</p>
            ) : null}
            {reportDone ? (
              <p role="status" className="text-sm text-primary">
                <T k="support.report.success" />
              </p>
            ) : null}
            <Button type="submit" disabled={report.isPending}>
              {report.isPending ? <T k="support.report.sending" /> : <T k="support.report.submit" />}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
