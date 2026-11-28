import { notFound, redirect } from "next/navigation";

import { resolveBookingTarget } from "@/lib/domain/booking-link";
import { routeMetadata } from "@/lib/metadata";

export const metadata = routeMetadata({
  path: "/b",
  titleKey: "nav.book",
  descriptionKey: "booking.subtitle",
  private: true,
});

function decodeSlug(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/** Canonical short booking link: a shop opens "any" flow, a chair opens its own. */
export default async function BookingLinkPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const target = await resolveBookingTarget(decodeSlug(slug)).catch(() => null);
  if (!target) notFound();

  if (target.business) {
    const query = new URLSearchParams({
      business: target.business,
      any: "1",
    });
    if (target.branch) query.set("branch", target.branch);
    redirect(`/book?${query.toString()}`);
  }

  if (target.barber) {
    redirect(`/book?barber=${encodeURIComponent(target.barber)}`);
  }

  notFound();
}
