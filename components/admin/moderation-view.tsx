"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
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
import {
  useAdminAnnouncements,
  useAdminReviews,
  useDeleteReview,
  useSendAnnouncement,
  type Audience,
} from "@/lib/api/admin-queries";

import { Empty, FormError, LoadingRows, Section, message } from "./admin-ui";

export function ModerationView() {
  const reviews = useAdminReviews();
  const remove = useDeleteReview();
  const announcements = useAdminAnnouncements();
  const send = useSendAnnouncement();

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState<Audience>("all");
  const [errorText, setErrorText] = useState<string | null>(null);

  const error =
    errorText ??
    (reviews.error ? message(reviews.error, "Could not load reviews.") : null) ??
    (announcements.error
      ? message(announcements.error, "Could not load announcements.")
      : null);

  function broadcast(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!title.trim() || !body.trim()) {
      setErrorText("Add a title and a message.");
      return;
    }
    setErrorText(null);
    send.mutate(
      { title, body, audience },
      {
        onSuccess: (sent) => {
          toast.success(`Announcement sent to ${sent} members`);
          setTitle("");
          setBody("");
        },
        onError: (cause) => {
          setErrorText(message(cause, "Could not send the announcement."));
          toast.error("Could not send the announcement");
        },
      },
    );
  }

  return (
    <div className="space-y-6">
      <Section
        title="Reviews"
        description="Remove anything that does not belong. Ratings are never edited."
      >
        <FormError text={error} />
        {reviews.isPending ? (
          <LoadingRows />
        ) : (reviews.data ?? []).length === 0 ? (
          <Empty>No reviews yet.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Member</TableHead>
                  <TableHead>Rating</TableHead>
                  <TableHead>Note</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(reviews.data ?? []).map((review) => (
                  <TableRow key={review.id}>
                    <TableCell className="font-mono text-xs">
                      {review.user.slice(0, 10)}
                    </TableCell>
                    <TableCell>{review.rate} / 5</TableCell>
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
                        disabled={remove.isPending}
                        onClick={() => {
                          if (!window.confirm("Remove this review?")) return;
                          remove.mutate(review.id, {
                            onError: (cause) =>
                              toast.error("Could not remove the review", {
                                description: message(cause, "Try again."),
                              }),
                          });
                        }}
                      >
                        Remove
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Section>

      <Section
        title="Portfolio images"
        description="Submitted work is moderated from the barber management page."
      >
        <p className="text-sm text-muted-foreground">
          <Link href="/admin/barbers" className="text-primary underline underline-offset-2">
            Open barber management →
          </Link>
        </p>
      </Section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section
          title="Announcement"
          description="Send one inbox notification to a chosen audience."
        >
          <form onSubmit={broadcast} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="announce-title">Title</Label>
              <Input
                id="announce-title"
                value={title}
                maxLength={96}
                placeholder="A short headline"
                onChange={(event) => setTitle(event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="announce-body">Message</Label>
              <Textarea
                id="announce-body"
                value={body}
                maxLength={512}
                placeholder="What should members know?"
                onChange={(event) => setBody(event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="announce-audience">Audience</Label>
              <Select
                value={audience}
                onValueChange={(value) => setAudience(value as Audience)}
              >
                <SelectTrigger id="announce-audience" className="h-9 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All members</SelectItem>
                  <SelectItem value="client">Clients</SelectItem>
                  <SelectItem value="barber">Barbers</SelectItem>
                  <SelectItem value="admin">Admins</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" disabled={send.isPending}>
              {send.isPending ? "Sending…" : "Send announcement"}
            </Button>
          </form>
        </Section>

        <Section title="Recent broadcasts" description="Sent announcements, newest first.">
          {announcements.isPending ? (
            <LoadingRows />
          ) : (announcements.data ?? []).length === 0 ? (
            <Empty>No announcements sent yet.</Empty>
          ) : (
            <ul className="divide-y">
              {(announcements.data ?? []).map((item) => (
                <li key={item.id} className="py-2">
                  <p className="text-sm font-medium">{item.title}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {item.body} · {item.created.slice(0, 10)}
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
