"use client";

import { ShieldCheck } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { SignOutButton } from "@/components/auth/sign-out-button";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { Role } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

const roleLabel: Record<Role, string> = {
  client: "Client",
  barber: "Barber",
  admin: "Admin",
};

/**
 * The customer area is for the client role only. Staff keep their own tools in
 * /agenda and /admin, and never see these views.
 */
export function ClientGate({ role, children }: { role: Role; children: ReactNode }) {
  if (role === "client") return <>{children}</>;

  return (
    <Card className="mx-auto max-w-lg">
      <CardHeader>
        <div className="flex items-center gap-2">
          <ShieldCheck className="size-4 text-brand-strong" aria-hidden />
          <CardTitle>This space is for client accounts</CardTitle>
        </div>
        <CardDescription>
          Your role is {roleLabel[role]}. Staff tools live in the agenda and the
          catalogue manager.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-3">
        <Link
          href="/account"
          className={cn(buttonVariants({ size: "sm" }), "h-9 rounded-xl")}
        >
          Back to account
        </Link>
        <SignOutButton />
      </CardContent>
    </Card>
  );
}
