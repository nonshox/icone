import type { Metadata } from "next";

import { BarberPortfolio } from "@/components/barber/barber-portfolio";
import { BarberShell } from "@/components/barber/barber-shell";
import { T } from "@/components/i18n/t";

export const metadata: Metadata = {
  title: "Portfolio",
  robots: { index: false, follow: false },
};

export default function BarberPortfolioPage() {
  return (
    <BarberShell
      title={<T k="nav.profile" />}
      description={<T k="work.portfolio.hint" />}
    >
      <BarberPortfolio />
    </BarberShell>
  );
}
