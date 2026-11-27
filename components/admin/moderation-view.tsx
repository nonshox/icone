"use client";

import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
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
import { Textarea } from "@/components/ui/textarea";
import { T } from "@/components/i18n/t";
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

import { Empty, FormError, LoadingRows, Section, message } from "./admin-ui";

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
                        href={item.url}
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
