import { RedirectType, redirect } from "next/navigation";
import { Suspense } from "react";

import { routeMetadata } from "@/lib/metadata";

export const metadata = routeMetadata({
  path: "/barber/notifications",
  titleKey: "nav.inbox",
  descriptionKey: "meta.private.description",
  private: true,
});

/**
 * Legacy professional inbox. Every signed-in account now uses the one inbox at
 * `/notifications`; forward the old workspace URL without losing its query.
 */
async function NotificationsRedirect({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) {
      for (const item of value) query.append(key, item);
    } else if (value !== undefined) {
      query.set(key, value);
    }
  }
  const suffix = query.toString();
  return redirect(
    `/notifications${suffix ? `?${suffix}` : ""}`,
    RedirectType.replace,
  );
}

export default function BarberNotificationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <Suspense fallback={null}>
      <NotificationsRedirect searchParams={searchParams} />
    </Suspense>
  );
}
