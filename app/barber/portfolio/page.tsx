import type { Metadata } from "next";

import { BarberPortfolio } from "@/components/barber/barber-portfolio";
import { BarberShell } from "@/components/barber/barber-shell";

export const metadata: Metadata = {
  title: "Portfolio",
  robots: { index: false, follow: false },
};

export default function BarberPortfolioPage() {
  return (
    <BarberShell
      title="Portfolio"
      description="The work you want members to see."
    >
      <BarberPortfolio />
    </BarberShell>
  );
}
