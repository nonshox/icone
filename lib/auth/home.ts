import type { Role } from "@/lib/domain/types";

/** Where each role lands after sign-in. */
export function homeForRole(role: Role): string {
  if (role === "barber") return "/barber";
  if (role === "admin") return "/admin";
  return "/customer";
}
