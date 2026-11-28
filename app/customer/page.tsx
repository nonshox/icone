import { RedirectType, redirect } from "next/navigation";
import { Suspense } from "react";

import { routeMetadata } from "@/lib/metadata";

export const metadata = routeMetadata({
  path: "/customer",
  titleKey: "nav.account",
  descriptionKey: "meta.private.description",
  private: true,
});

/**
 * Legacy customer home. `/account` is now the one account home, so preserve
 * every query parameter (including `?next=` deep links) and forward visitors.
 */
async function CustomerRedirect({
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
  return redirect(`/account${suffix ? `?${suffix}` : ""}`, RedirectType.replace);
}

export default function CustomerPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <Suspense fallback={null}>
      <CustomerRedirect searchParams={searchParams} />
    </Suspense>
  );
}
