import { CalendarDays, Check, Clock3, Scissors, Star } from "lucide-react";
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const days = [
  { day: "Today", date: "24" },
  { day: "Tue", date: "25" },
  { day: "Wed", date: "26" },
] as const;

const slots = ["17:30", "18:00", "18:30", "19:00", "19:30", "20:00"] as const;

/**
 * A designed preview of the booking flow. It is intentionally static — the
 * real booking engine ships in the next milestone (see docs/PROJECT.md).
 */
export function BookingPreview() {
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
            Next available
          </div>
          <span className="rounded-full border border-border/80 px-2.5 py-1 text-[0.65rem] font-medium tracking-wide text-muted-foreground uppercase">
            Preview
          </span>
        </div>

        <div className="mt-5 flex items-center gap-3">
          <div className="grid size-12 place-items-center rounded-2xl bg-[linear-gradient(140deg,oklch(0.87_0.09_84),oklch(0.62_0.11_52))] text-lg font-semibold text-[oklch(0.22_0.03_60)] shadow-inner">
            B
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">Bekzod R.</p>
            <p className="truncate text-xs text-muted-foreground">
              Senior barber · Fades &amp; beard sculpting
            </p>
          </div>
          <div className="flex items-center gap-1 rounded-full bg-foreground/[0.04] px-2 py-1 text-xs">
            <Star className="size-3 fill-brand text-brand" aria-hidden />
            4.9
          </div>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-2">
          {days.map((item, index) => (
            <div
              key={item.day}
              className={cn(
                "rounded-xl border px-2 py-2.5 text-center transition-colors",
                index === 0
                  ? "border-brand/40 bg-brand/10"
                  : "border-border/70 bg-foreground/[0.02]",
              )}
            >
              <p className="text-[0.65rem] font-medium tracking-wide text-muted-foreground uppercase">
                {item.day}
              </p>
              <p className="mt-0.5 text-sm font-medium">{item.date}</p>
            </div>
          ))}
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          {slots.map((slot) => (
            <div
              key={slot}
              className={cn(
                "rounded-xl border py-2 text-center text-sm tabular-nums",
                slot === "18:30"
                  ? "border-transparent bg-primary text-primary-foreground shadow-sm"
                  : "border-border/70 text-muted-foreground",
              )}
            >
              {slot}
            </div>
          ))}
        </div>

        <div className="mt-5 space-y-2.5 rounded-2xl bg-foreground/[0.035] p-3.5">
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2 text-muted-foreground">
              <Scissors className="size-3.5" aria-hidden />
              Skin fade + beard
            </span>
            <span className="font-medium tabular-nums">120 000 UZS</span>
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="flex items-center gap-2">
              <Clock3 className="size-3.5" aria-hidden />
              45 min · Today, 18:30
            </span>
            <span className="flex items-center gap-1.5 text-emerald-500">
              <Check className="size-3.5" aria-hidden />
              Chair held 10 min
            </span>
          </div>
        </div>

        <Link
          href="/sign-in"
          className={cn(
            buttonVariants({ size: "lg" }),
            "mt-4 h-11 w-full gap-2 rounded-xl text-sm",
          )}
        >
          <CalendarDays className="size-4" aria-hidden />
          Sign in to book this chair
        </Link>

        <p className="mt-3 text-center text-[0.7rem] text-muted-foreground">
          One-time email code or Telegram. No password, no card needed.
        </p>
      </div>

      <div className="glass absolute -top-5 -right-3 hidden items-center gap-2 rounded-2xl px-3.5 py-2.5 text-xs font-medium sm:flex">
        <span className="grid size-6 place-items-center rounded-full bg-emerald-500/15 text-emerald-500">
          <Check className="size-3.5" aria-hidden />
        </span>
        Chair confirmed
      </div>

      <div className="glass-soft absolute -bottom-5 -left-4 hidden rounded-2xl px-3.5 py-2.5 text-xs text-muted-foreground sm:block">
        <span className="font-medium text-foreground">No queue.</span> Just a
        time that fits.
      </div>
    </div>
  );
}
