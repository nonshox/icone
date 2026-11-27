"use client";

import { ArrowLeft, Loader2, MessageCircle, Send } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useSendMessage,
  useThread,
  useThreads,
} from "@/lib/api/message-queries";
import { useProfile } from "@/lib/api/queries";
import { T } from "@/components/i18n/t";
import { useT } from "@/lib/i18n/use-t";
import type { Message } from "@/lib/domain/messages";
import { useLocaleStore, type Locale } from "@/lib/store/locale";
import { cn } from "@/lib/utils";

const DATE_LOCALES: Record<Locale, string> = {
  uz: "uz-UZ",
  ru: "ru-RU",
  en: "en-GB",
};

function detail(iso: string, locale: Locale): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(DATE_LOCALES[locale], {
    timeZone: "Asia/Tashkent",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
}

function clock(iso: string, locale: Locale): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(DATE_LOCALES[locale], {
    timeZone: "Asia/Tashkent",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
}

function message(_error: unknown, fallback: string): string {
  // Server errors are English; the localized fallback is the user-facing copy.
  return fallback;
}

function Bubble({
  item,
  own,
  locale,
}: {
  item: Message;
  own: boolean;
  locale: Locale;
}) {
  return (
    <div className={cn("flex flex-col gap-1", own ? "items-end" : "items-start")}>
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed break-words",
          own
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-foreground",
        )}
      >
        {item.body}
      </div>
      <span className="px-1 text-[0.7rem] text-muted-foreground tabular-nums">
        {clock(item.created, locale)}
      </span>
    </div>
  );
}

export function MessagesView({ initialWith }: { initialWith: string | null }) {
  const t = useT();
  const locale = useLocaleStore((state) => state.locale);
  const [selected, setSelected] = useState<string | null>(initialWith);
  const [conversation, setConversation] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [sendError, setSendError] = useState<string | null>(null);
  const bottom = useRef<HTMLDivElement | null>(null);

  const profile = useProfile();
  const threads = useThreads();
  const thread = useThread(selected, conversation);
  const send = useSendMessage();

  const messages = thread.data?.messages ?? [];

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [messages.length, selected]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = draft.trim();
    if (!selected || !text || send.isPending) return;

    setSendError(null);
    send.mutate(
      { to: selected, body: text },
      {
        onSuccess: () => setDraft(""),
        onError: (error) => {
          const textError = message(error, t("auth.tryAgain"));
          setSendError(textError);
          toast.error(t("msg.sendFailed"), { description: textError });
        },
      },
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-[18rem_minmax(0,1fr)]">
      <Card
        className={cn(
          "flex min-h-80 flex-col overflow-hidden",
          selected && "hidden md:flex",
        )}
      >
        <CardHeader className="border-b pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <MessageCircle className="size-4 text-brand-strong" aria-hidden />
            <T k="msg.title" />
          </CardTitle>
          <CardDescription><T k="msg.subtitle" /></CardDescription>
        </CardHeader>

        <CardContent className="flex-1 space-y-1.5 p-2">
          {threads.isPending ? (
            <div className="space-y-2 p-2" aria-hidden>
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
            </div>
          ) : null}

          {threads.isError ? (
            <p
              role="alert"
              aria-live="polite"
              className="m-2 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {message(threads.error, t("msg.loadError"))}
            </p>
          ) : null}

          {threads.data?.length === 0 ? (
            <div className="px-3 py-8 text-center">
              <p className="text-sm font-medium"><T k="msg.empty" /></p>
              <p className="mt-1 text-xs text-muted-foreground">
                <T k="msg.emptyHint" />
              </p>
            </div>
          ) : null}

          {threads.data?.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setSelected(item.id);
                setConversation(item.conversation ?? item.id);
                setDraft("");
                setSendError(null);
              }}
              className={cn(
                "flex w-full flex-col gap-1 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-muted",
                selected === item.id && "bg-muted",
              )}
            >
              <span className="flex items-baseline justify-between gap-2">
                <span className="truncate text-sm font-medium">{item.name}</span>
                <span className="shrink-0 text-[0.7rem] text-muted-foreground tabular-nums">
                  {detail(item.at ?? item.lastAt ?? "", locale)}
                </span>
              </span>
              <span className="line-clamp-1 text-xs text-muted-foreground">
                {item.preview}
              </span>
            </button>
          ))}
        </CardContent>
      </Card>

      <Card
        className={cn(
          "flex min-h-80 flex-col overflow-hidden",
          !selected && "hidden md:flex",
        )}
      >
        {selected ? (
          <>
            <CardHeader className="border-b py-3">
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="md:hidden"
                  aria-label={t("msg.back")}
                  onClick={() => {
                    setSelected(null);
                    setSendError(null);
                  }}
                >
                  <ArrowLeft aria-hidden />
                </Button>
                <div>
                  <CardTitle className="text-base">
                    {thread.data?.participant.name ?? t("msg.title")}
                  </CardTitle>
                  <CardDescription className="text-xs">
                    {thread.isPending
                      ? t("common.loading")
                      : t("msg.count").replace("{n}", String(messages.length))}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>

            <CardContent className="flex-1 space-y-3 overflow-y-auto py-4">
              {thread.isPending ? (
                <div className="space-y-3" aria-hidden>
                  <Skeleton className="h-9 w-2/3" />
                  <Skeleton className="ml-auto h-9 w-1/2" />
                  <Skeleton className="h-9 w-3/5" />
                </div>
              ) : null}

              {thread.isError ? (
                <p
                  role="alert"
                  aria-live="polite"
                  className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
                >
                  {message(thread.error, t("msg.openError"))}
                </p>
              ) : null}

              {thread.isSuccess && messages.length === 0 ? (
                <div className="py-10 text-center">
                  <p className="text-sm font-medium"><T k="msg.sayHello" /></p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    <T k="msg.sayHelloHint" />
                  </p>
                </div>
              ) : null}

              {messages.map((item) => (
                <Bubble
                  key={item.id}
                  item={item}
                  own={item.sender === profile.data?.id}
                  locale={locale}
                />
              ))}
              <div ref={bottom} />
            </CardContent>

            {thread.isError ? null : (
              <div className="border-t p-3">
                {profile.data?.role === "admin" ? (
                  <p className="text-xs text-muted-foreground">
                    <T k="msg.adminReadOnly" />
                  </p>
                ) : (
                  <>
                    {sendError ? (
                      <p
                        role="alert"
                        aria-live="polite"
                        className="mb-2 text-xs text-destructive"
                      >
                        {sendError}
                      </p>
                    ) : null}
                    <form onSubmit={submit} className="flex items-center gap-2">
                      <Input
                        value={draft}
                        maxLength={1000}
                        placeholder={t("msg.placeholder")}
                        aria-label={t("msg.messageLabel")}
                        onChange={(event) => setDraft(event.target.value)}
                      />
                      <Button
                        type="submit"
                        size="icon"
                        aria-label={t("msg.send")}
                        disabled={!draft.trim() || send.isPending}
                      >
                        {send.isPending ? (
                          <Loader2 className="animate-spin" aria-hidden />
                        ) : (
                          <Send aria-hidden />
                        )}
                      </Button>
                    </form>
                  </>
                )}
              </div>
            )}
          </>
        ) : (
          <CardContent className="flex flex-1 flex-col items-center justify-center gap-2 py-16 text-center">
            <MessageCircle
              className="size-7 text-brand-strong"
              aria-hidden
            />
            <p className="text-sm font-medium"><T k="msg.pick" /></p>
            <p className="max-w-xs text-xs text-muted-foreground">
              <T k="msg.pickHint" />
            </p>
            <Badge variant="outline" className="mt-2">
              <T k="msg.private" />
            </Badge>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
