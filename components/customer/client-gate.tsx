"use client";

import type { ReactNode } from "react";

import type { Role } from "@/lib/domain/types";

/**
 * Customer pages stay open to every signed-in account. An approved barber is
 * still a customer too (their profile role remains "client"), so there is no
 * forced role gate here — the workspace is reached from the account and menu.
 * The optional `role` is kept so existing callers stay source-compatible.
 */
export function ClientGate({
  role: _role,
  children,
}: {
  role?: Role;
  children: ReactNode;
}) {
  void _role;
  return <>{children}</>;
}
