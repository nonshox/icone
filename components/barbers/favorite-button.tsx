"use client";

import { Heart, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api/client";
import { useToggleFavorite } from "@/lib/api/customer-queries";
import { cn } from "@/lib/utils";

export function FavoriteButton({
  barber,
  initialSaved,
}: {
  barber: string;
  initialSaved: boolean;
}) {
  const router = useRouter();
  const toggle = useToggleFavorite();
  const [saved, setSaved] = useState(initialSaved);

  function onClick() {
    toggle.mutate(barber, {
      onSuccess: (result) => {
        setSaved(result.saved);
        toast.success(result.saved ? "Saved to your chairs" : "Removed from saved chairs");
      },
      onError: (error) => {
        if (error instanceof ApiError && error.status === 401) {
          router.push(
            `/sign-in?next=${encodeURIComponent(`/barbers/${barber}`)}`,
          );
          return;
        }
        toast.error("Could not update", {
          description: error instanceof Error ? error.message : "Please try again.",
        });
      },
    });
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={cn(
        "h-9 rounded-xl",
        saved && "border-brand/60 bg-brand/10 text-brand-strong",
      )}
      aria-pressed={saved}
      aria-label={saved ? "Remove from saved barbers" : "Save this barber"}
      disabled={toggle.isPending}
      onClick={onClick}
    >
      {toggle.isPending ? (
        <Loader2 className="size-3.5 animate-spin" aria-hidden />
      ) : (
        <Heart className={cn("size-3.5", saved && "fill-current")} aria-hidden />
      )}
      {saved ? "Saved" : "Save"}
    </Button>
  );
}
