import { ArrowRight, Check, Clock3, Scissors, Star } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { T } from "@/components/i18n/t";
import { buttonVariants } from "@/components/ui/button";
import type { Barber, Service } from "@/lib/domain/types";
import { formatPrice } from "@/lib/domain/time";
import { cn } from "@/lib/utils";

/** Live catalogue preview — every value comes from the database. */
export function BookingPreview({
  barbers,
  services,
}: {
  barbers: Barber[];
  services: Service[];
}) {
  const barber = barbers[0];
  const service = services[0];

  return (
    <div className="relative mx-auto w-full max-w-md lg:max-w-none">
      <div
        aria-hidden
        className="absolute -inset-8 -z-10 rounded-[3rem] bg-brand/12 blur-3xl"
      />

      <div className="glass relative rounded-[1.75rem] p-4 sm:p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
            </span>
            <T k="landing.liveCatalog" />
          </div>
          <span className="inline-flex items-center rounded-full border border-border/80 px-2 py-1">
            <Image
              src="/logotype/android-chrome-192x192.png"
              alt="icone"
              width={192}
              height={192}
              className="size-4 rounded-[4px]"
            />
          </span>
        </div>

        {barber ? (
          <div className="mt-5 flex items-center gap-3">
            <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-brand/12 text-lg font-semibold text-brand-strong">
              {barber.name.slice(0, 1)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{barber.name}</p>
              <p className="truncate text-xs text-muted-foreground">
                {barber.shop || barber.title || "Barber"} · {barber.city}
              </p>
            </div>
            {barber.rating > 0 ? (
              <span className="flex items-center gap-1 rounded-full bg-foreground/[0.04] px-2 py-1 text-xs">
                <Star className="size-3 fill-brand text-brand" aria-hidden />
                {barber.rating.toFixed(1)}
              </span>
            ) : null}
          </div>
        ) : (
          <p className="mt-5 text-sm text-muted-foreground">No barbers yet.</p>
        )}

        {service ? (
          <div className="mt-4 space-y-2.5 rounded-2xl bg-foreground/[0.035] p-3.5">
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="flex min-w-0 items-center gap-2 text-muted-foreground">
                <Scissors className="size-3.5 shrink-0" aria-hidden />
                <span className="truncate">{service.name}</span>
              </span>
              <span className="shrink-0 font-medium tabular-nums">
                {formatPrice(service.price)}
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Clock3 className="size-3.5" aria-hidden />
              {service.time} min
            </div>
          </div>
        ) : null}

        {barbers.length > 1 ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {barbers.slice(0, 3).map((item) => (
              <Link
                key={item.id}
                href={`/barbers/${item.id}`}
                className="rounded-full border border-border/70 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-brand/40 hover:text-foreground"
              >
                {item.name}
              </Link>
            ))}
          </div>
        ) : null}

        <Link
          href={
            barber && service
              ? `/book?barber=${barber.id}&service=${service.id}`
              : "/book"
          }
          className={cn(
            buttonVariants({ size: "lg" }),
            "mt-5 h-11 w-full gap-2 rounded-xl text-sm",
          )}
        >
          <T k="landing.checkTimes" />
          <ArrowRight className="size-4" aria-hidden />
        </Link>

        <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-[0.7rem] text-muted-foreground">
          <Check className="size-3 text-emerald-500" aria-hidden />
          Real barbers, real prices, live availability.
        </p>
      </div>
    </div>
  );
}
