"use client";

import { Heart, MapPin, Scissors, Star, Trash2 } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

import { ClientGate } from "@/components/customer/client-gate";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useFavorites, useRemoveFavorite } from "@/lib/api/customer-queries";
import type { Profile } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

export function FavoritesView({ profile }: { profile: Profile }) {
  const favorites = useFavorites();
  const remove = useRemoveFavorite();

  function onRemove(id: string, name: string) {
    if (!window.confirm(`Remove ${name} from your saved chairs?`)) return;
    remove.mutate(id, {
      onSuccess: () => toast.success("Removed from saved chairs"),
      onError: (error) =>
        toast.error("Could not remove", {
          description: error instanceof Error ? error.message : "Please try again.",
        }),
    });
  }

  return (
    <ClientGate role={profile.role}>
      <div className="space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-medium tracking-[0.18em] text-brand-strong uppercase">
              Saved chairs
            </p>
          </div>
          {favorites.data && favorites.data.length > 0 ? (
            <Badge variant="secondary" className="tabular-nums">
              {favorites.data.length} saved
            </Badge>
          ) : null}
        </div>

        {favorites.isPending ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <Skeleton className="h-56 w-full" />
            <Skeleton className="h-56 w-full" />
          </div>
        ) : favorites.isError ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              Could not load your saved chairs. Refresh the page to try again.
            </CardContent>
          </Card>
        ) : (favorites.data ?? []).length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Heart className="size-4 text-brand-strong" aria-hidden />
                Nothing saved yet
              </CardTitle>
              <CardDescription>Save a barber from their profile.</CardDescription>
            </CardHeader>
            <CardContent>
              <Link
                href="/barbers"
                className={cn(buttonVariants({ size: "sm" }), "h-9 rounded-xl")}
              >
                Browse barbers
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {(favorites.data ?? []).map((item) => (
              <Card key={item.id} size="sm" className="h-full">
                <div
                  aria-hidden
                  className="h-28 w-full shrink-0 bg-muted bg-cover bg-center"
                  style={photoStyle(item.photo)}
                />
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <CardTitle className="truncate text-base">{item.name}</CardTitle>
                      <CardDescription className="truncate">
                        {item.title || "Barber"}
                      </CardDescription>
                    </div>
                    {item.rating > 0 ? (
                      <Badge variant="secondary" className="shrink-0 tabular-nums">
                        <Star className="size-3 fill-current" aria-hidden />
                        {item.rating.toFixed(1)}
                      </Badge>
                    ) : null}
                  </div>
                </CardHeader>
                <CardContent className="flex h-full flex-col justify-between gap-4">
                  <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
                    <MapPin className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                    {[item.shop, item.address, item.city].filter(Boolean).join(" · ") ||
                      "Tashkent"}
                  </p>
                  <div className="flex gap-2">
                    <Link
                      href={`/book?barber=${item.barber}`}
                      className={cn(buttonVariants({ size: "sm" }), "h-9 flex-1 rounded-xl")}
                    >
                      <Scissors className="size-3.5" aria-hidden />
                      Quick book
                    </Link>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-9 rounded-xl"
                      aria-label={`Remove ${item.name} from saved chairs`}
                      disabled={remove.isPending}
                      onClick={() => onRemove(item.barber, item.name)}
                    >
                      <Trash2 className="size-3.5" aria-hidden />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </ClientGate>
  );
}

function photoStyle(url: string) {
  if (!/^https?:\/\//.test(url)) return undefined;
  return { backgroundImage: `url("${url.replace(/"/g, "%22")}")` };
}
