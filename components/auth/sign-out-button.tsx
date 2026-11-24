"use client";

import { Loader2, LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

export function SignOutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function signOut() {
    setPending(true);
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (!response.ok) throw new Error("Sign out failed");

      toast.success("Signed out", {
        description: "Your session has been ended.",
      });
      router.replace("/");
      router.refresh();
    } catch {
      toast.error("Could not sign out", {
        description: "Check your connection and try again.",
      });
      setPending(false);
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={signOut}
      disabled={pending}
      className="h-9 gap-2 rounded-xl"
    >
      {pending ? (
        <Loader2 className="size-4 animate-spin" aria-hidden />
      ) : (
        <LogOut className="size-4" aria-hidden />
      )}
      {pending ? "Signing out" : "Sign out"}
    </Button>
  );
}
