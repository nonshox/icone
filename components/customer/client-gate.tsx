"use client";

import { ShieldCheck } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { T } from "@/components/i18n/t";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useT } from "@/lib/i18n/use-t";
import type { Role } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

/**
 * The customer area is for the client role only. Staff keep their own tools in
 * /agenda and /admin, and never see these views.
 */
export function ClientGate({ role, children }: { role: Role; children: ReactNode }) {
  const t = useT();
  if (role === "client") return <>{children}</>;

  return (
    <Card className="mx-auto max-w-lg">
      <CardHeader>
        <div className="flex items-center gap-2">
          <ShieldCheck className="size-4 text-brand-strong" aria-hidden />
          <CardTitle><T k="customer.gateTitle" /></CardTitle>
        </div>
        <CardDescription>
          <T k="customer.gateBody" /> {t(`role.${role}`)}.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-3">
        <Link
          href="/account"
          className={cn(buttonVariants({ size: "sm" }), "h-9 rounded-xl")}
        >
          <T k="customer.backAccount" />
        </Link>
        <SignOutButton />
      </CardContent>
    </Card>
  );
}
