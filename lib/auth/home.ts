import type { Role } from "@/lib/domain/types";

/** Where each role lands after sign-in. */
export function homeForRole(role: Role): string {
  // The calendar is the professional home; the overview is a secondary page.
  if (role === "barber") return "/agenda";
  if (role === "admin") return "/admin";
  return "/customer";
}
