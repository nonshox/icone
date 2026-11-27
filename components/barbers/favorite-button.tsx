"use client";

import { Heart, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { T } from "@/components/i18n/t";
import { Button, buttonVariants } from "@/components/ui/button";
import { ApiError } from "@/lib/api/client";
import { useFavorites, useToggleFavorite } from "@/lib/api/customer-queries";
import { useProfile } from "@/lib/api/queries";
import { useT } from "@/lib/i18n/use-t";
import { cn } from "@/lib/utils";

function SavedButton({
  barber,
  initialSaved,
}: {
  barber: string;
  initialSaved: boolean;
}) {
  const t = useT();
  const router = useRouter();
  const toggle = useToggleFavorite();
  const favorites = useFavorites();

  const saved = favorites.isPending
    ? initialSaved
    : (favorites.data ?? []).some((item) => item.barber === barber);

  function onClick() {
    toggle.mutate(barber, {
      onSuccess: (result) => {
        toast.success(result.saved ? t("common.saved") : t("favorites.removed"));
      },
      onError: (error) => {
        if (error instanceof ApiError && error.status === 401) {
          router.push(
            `/sign-in?next=${encodeURIComponent(`/barbers/${barber}`)}`,
          );
          return;
        }
        toast.error(t("inbox.failed"), {
          description: error instanceof Error ? error.message : t("auth.tryAgain"),
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
      aria-label={saved ? t("favorites.removeAsk") : t("favorites.saveThis")}
      disabled={toggle.isPending}
      onClick={onClick}
    >
      {toggle.isPending ? (
        <Loader2 className="size-3.5 animate-spin" aria-hidden />
      ) : (
        <Heart className={cn("size-3.5", saved && "fill-current")} aria-hidden />
      )}
      {saved ? <T k="common.saved" /> : <T k="favorites.save" />}
    </Button>
  );
}

/**
 * Guests never hit /api/favorites: the session is checked first and they get
 * a sign-in link instead. Signed-in behaviour is unchanged.
 */
export function FavoriteButton({
  barber,
  initialSaved = false,
}: {
  barber: string;
  initialSaved?: boolean;
}) {
  const profile = useProfile();
  const t = useT();
  const next = encodeURIComponent(`/barbers/${barber}`);

  if (profile.isPending) {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled
        className="h-9 rounded-xl"
        aria-label={t("favorites.saveThis")}
      >
        <Heart className="size-3.5" aria-hidden />
      </Button>
    );
  }

  if (!profile.data) {
    return (
      <Link
        href={`/sign-in?next=${next}`}
        className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-9 rounded-xl")}
      >
        <Heart className="size-3.5" aria-hidden />
        <T k="favorites.signInToSave" />
      </Link>
    );
  }

  return <SavedButton barber={barber} initialSaved={initialSaved} />;
}
