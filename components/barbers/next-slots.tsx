"use client";

import { ExternalLink } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { T } from "@/components/i18n/t";
import { useAvailability } from "@/lib/api/queries";
import { useShopDate } from "@/lib/client/date";
import { useT } from "@/lib/i18n/use-t";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { addDays, formatDate } from "@/lib/domain/time";
import type { Service } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

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
  const [selected, setSelected] = useState("");

  const dates = useMemo(
    () => (shopDate ? [0, 1, 2].map((offset) => addDays(shopDate, offset)) : []),
    [shopDate],
  );
  const date = selected && dates.includes(selected) ? selected : (dates[0] ?? "");

  const availability = useAvailability({
    barber,
    date,
    service: service?.id ?? "",
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle><T k="barber.nextTimes" /></CardTitle>
        {date && service ? (
          <CardDescription>
            {formatDate(date)} · {service.name}
          </CardDescription>
        ) : null}
      </CardHeader>
      <CardContent>
        {!service ? (
          <p className="py-2 text-sm leading-relaxed text-muted-foreground">
            <T k="booking.pickServiceBarber" />
          </p>
        ) : !date ? (
          <div className="flex flex-wrap gap-2" aria-hidden>
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-8 w-14" />
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2" role="group" aria-label={t("slots.chooseDate")}>
              {dates.map((day) => (
                <button
                  key={day}
                  type="button"
                  onClick={() => setSelected(day)}
                  aria-pressed={day === date}
                  className={cn(
                    "h-8 rounded-lg px-2.5 text-sm font-medium transition-colors",
                    day === date
                      ? "bg-brand text-brand-foreground"
                      : "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
                  )}
                >
                  {formatDate(day)}
                </button>
              ))}
            </div>

            {availability.isPending ? (
              <div className="flex flex-wrap gap-2" aria-hidden>
                {Array.from({ length: 6 }).map((_, index) => (
                  <Skeleton key={index} className="h-8 w-14" />
                ))}
              </div>
            ) : availability.isError ? (
              <p role="alert" className="text-sm text-destructive">
                <T k="slots.error" />
              </p>
            ) : (availability.data ?? []).length === 0 ? (
              <p className="py-2 text-sm leading-relaxed text-muted-foreground">
                <T k="slots.empty" />
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {availability.data.slice(0, 10).map((slot) => (
                  <Link
                    key={slot.start}
                    href={`/book?barber=${encodeURIComponent(barber)}&service=${encodeURIComponent(service.id)}&date=${encodeURIComponent(date)}&start=${slot.start}`}
                    className={cn(
                      "inline-flex h-8 items-center justify-center rounded-lg border border-input bg-background px-2.5 text-sm font-medium tabular-nums hover:bg-accent hover:text-accent-foreground",
                    )}
                  >
                    {slot.label}
                  </Link>
                ))}
              </div>
            )}

            <Link
              href={`/book?barber=${encodeURIComponent(barber)}`}
              className="inline-flex items-center gap-1 text-sm font-medium text-brand-strong hover:underline"
            >
              {t("barber.allTimes")}
              <ExternalLink className="size-3.5" aria-hidden />
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
