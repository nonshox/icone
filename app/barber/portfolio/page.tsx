
import { routeMetadata } from "@/lib/metadata";
import { BarberPortfolio } from "@/components/barber/barber-portfolio";
import { BarberShell } from "@/components/barber/barber-shell";
import { T } from "@/components/i18n/t";

export const metadata = routeMetadata({
  path: "/barber/portfolio",
  titleKey: "work.portfolio.work",
  descriptionKey: "work.portfolio.hint",
  private: true,
});

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
