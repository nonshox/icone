import type { Metadata } from "next";

import { BarberPromotions } from "@/components/barber/barber-promotions";
import { BarberShell } from "@/components/barber/barber-shell";

export const metadata: Metadata = {
  title: "Offers",
  robots: { index: false, follow: false },
};

export default function BarberPromotionsPage() {
  return (
    <BarberShell
      title="Offers"
      description="Promotions for your chair."
    >
      <BarberPromotions />
    </BarberShell>
  );
}
