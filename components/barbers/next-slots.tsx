"use client";

import { useQuery } from "@tanstack/react-query";
import { ExternalLink } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";

import { T } from "@/components/i18n/t";
import { useT } from "@/lib/i18n/use-t";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { api } from "@/lib/api/client";
import { useShopDate } from "@/lib/client/date";
import { formatDate, nextDates } from "@/lib/domain/time";
import type { Service, Slot } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

type Preview = { date: string; slots: Slot[] };

/** Nearby open times live in the client so no build-day clock leaks into HTML. */
export function NextSlots({
  barber,
  service,
}: {
  barber: string;
  service: Service | null;
}) {
  const t = useT();
  const shopDate = useShopDate();
  const dates = useMemo(() => (shopDate ? nextDates(3) : []), [shopDate]);

  const preview = useQuery({
    queryKey: ["barber-preview", barber, service?.id ?? "", dates.join(",")],
    enabled: Boolean(shopDate && service),
    staleTime: 60_000,
    queryFn: async (): Promise<Preview | null> => {
      if (!service) return null;
      for (const date of dates) {
        try {
          const { slots } = await api<{ slots: Slot[] }>(
            `/api/availability?barber=${encodeURIComponent(barber)}&date=${encodeURIComponent(date)}&service=${encodeURIComponent(service.id)}`,
          );
          if (slots.length > 0) return { date, slots };
        } catch {
          // A chair can be closed on one day and open on the next.
        }
      }
      return null;
    },
  });

  const shown = preview.data;

  return (
    <Card>
      <CardHeader>
        <CardTitle><T k="barber.nextTimes" /></CardTitle>
        {shown ? (
          <CardDescription>
            {formatDate(shown.date)} · {service?.name}
          </CardDescription>
        ) : null}
      </CardHeader>
      <CardContent>
        {!service ? (
          <p className="py-2 text-sm leading-relaxed text-muted-foreground">
            <T k="barber.noTimes" />
          </p>
        ) : preview.isPending ? (
          <div className="flex flex-wrap gap-2" aria-hidden>
            {Array.from({ length: 6 }).map((_, index) => (
              <span
                key={index}
                className="h-8 w-14 animate-pulse rounded-lg bg-foreground/[0.06]"
              />
            ))}
          </div>
        ) : shown ? (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {shown.slots.slice(0, 10).map((slot) => (
                <Link
                  key={slot.start}
                  href={`/book?barber=${encodeURIComponent(barber)}&service=${encodeURIComponent(service.id)}&date=${encodeURIComponent(shown.date)}&start=${slot.start}`}
                  className={cn(
                    "h-8 rounded-lg px-2.5 tabular-nums",
                    "inline-flex items-center justify-center border border-input bg-background text-sm font-medium hover:bg-accent hover:text-accent-foreground",
                  )}
                >
                  {slot.label}
                </Link>
              ))}
            </div>
            <Link
              href={`/book?barber=${encodeURIComponent(barber)}`}
              className="inline-flex items-center gap-1 text-sm font-medium text-brand-strong hover:underline"
            >
              {t("barber.allTimes")}
              <ExternalLink className="size-3.5" aria-hidden />
            </Link>
          </div>
        ) : (
          <p className="py-2 text-sm leading-relaxed text-muted-foreground">
            <T k="barber.noTimes" />
          </p>
        )}
      </CardContent>
    </Card>
  );
}
