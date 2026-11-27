"use client";

import { RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { T } from "@/components/i18n/t";
import { useT } from "@/lib/i18n/use-t";
import { Button } from "@/components/ui/button";
import type { BookingRow } from "@/lib/domain/types";
import { useBookingDraft } from "@/lib/store/booking-draft";

/**
 * Seed a fresh draft from an existing visit, then open the real booking form.
 * No data is invented: only ids and the barber are copied; the customer picks
 * a new date and time from live availability.
 */
export function RebookButton({
  booking,
  className,
}: {
  booking: BookingRow;
  className?: string;
}) {
  const router = useRouter();
  const t = useT();

  function rebook() {
    const services =
      booking.items.length > 0 ? booking.items : [booking.service];
    useBookingDraft.getState().seed({ barber: booking.barber, services });
    toast.success(t("visits.rebookReady"));
    router.push("/book");
  }

  return (
    <Button type="button" variant="outline" size="sm" className={className} onClick={rebook}>
      <RotateCcw aria-hidden />
      <T k="visits.rebook" />
    </Button>
  );
}
