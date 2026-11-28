"use client";

import { Heart, MapPin, Scissors, Star, Trash2 } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

import { T } from "@/components/i18n/t";
import { ClientGate } from "@/components/customer/client-gate";
import {
  EmptyState,
  ErrorState,
  LoadingRows,
  message,
} from "@/components/ui/app-state";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useFavorites, useRemoveFavorite } from "@/lib/api/customer-queries";
import { useBarbers, useProfile } from "@/lib/api/queries";
import { imageUrl } from "@/lib/client/files";
import { useT } from "@/lib/i18n/use-t";
import { cn } from "@/lib/utils";

function photoStyle(value: string) {
  const url = imageUrl(value);
  if (!/^https?:\/\//.test(url)) return undefined;
  return { backgroundImage: `url("${url.replace(/"/g, "%22")}")` };
}

export function FavoritesView() {
  const t = useT();
  const profile = useProfile();
  const favorites = useFavorites();
  const barbers = useBarbers();
  const remove = useRemoveFavorite();

  function onRemove(barber: string) {
    if (!window.confirm(t("favorites.removeAsk"))) return;
    remove.mutate(barber, {
      onSuccess: () => toast.success(t("favorites.removed")),
      onError: (error) =>
        toast.error(t("favorites.removeFailed"), {
          description: message(error, t("auth.tryAgain")),
        }),
    });
  }

  if (profile.isPending) {
    return (
      <LoadingRows
        count={2}
        className="grid gap-4 space-y-0 sm:grid-cols-2"
        rowClassName="h-56 w-full"
      />
    );
  }

  if (profile.isError || !profile.data) {
    return <ErrorState fallback={t("customer.loadError")} />;
  }

  const barberById = new Map((barbers.data ?? []).map((barber) => [barber.id, barber]));

  return (
    <ClientGate role={profile.data.role}>
      <div className="space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-medium tracking-[0.18em] text-brand-strong uppercase">
              <T k="favorites.title" />
            </p>
          </div>
          {favorites.data && favorites.data.length > 0 ? (
            <Badge variant="secondary" className="tabular-nums">
              {favorites.data.length} {t("favorites.count")}
            </Badge>
          ) : null}
        </div>

        {favorites.isPending ? (
          <LoadingRows
            count={2}
            className="grid gap-4 space-y-0 sm:grid-cols-2"
            rowClassName="h-56 w-full"
          />
        ) : favorites.isError ? (
          <ErrorState fallback={t("favorites.loadError")} />
        ) : favorites.data.length === 0 ? (
          <EmptyState
            icon={<Heart className="size-5" aria-hidden />}
            title={<T k="favorites.emptyTitle" />}
            description={<T k="favorites.emptyBody" />}
            action={
              <Link
                href="/barbers"
                className={cn(buttonVariants({ size: "sm" }), "h-9 rounded-xl")}
              >
                <T k="favorites.browse" />
              </Link>
            }
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {favorites.data.map((item) => {
              const barber = barberById.get(item.barber);
              const name = item.name ?? barber?.name ?? t("favorites.barberFallback");
              const location = [barber?.shop, barber?.address, barber?.city]
                .filter(Boolean)
                .join(" · ");
              return (
                <Card key={item.id} size="sm" className="h-full">
                  <div
                    aria-hidden
                    className="h-28 w-full shrink-0 bg-muted bg-cover bg-center"
                    style={photoStyle(item.photo ?? barber?.photo ?? "")}
                  />
                  <CardHeader>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <CardTitle className="truncate text-base">{name}</CardTitle>
                        <CardDescription className="truncate">
                          {barber?.title || t("favorites.barberFallback")}
                        </CardDescription>
                      </div>
                      {barber && barber.rating > 0 ? (
                        <Badge variant="secondary" className="shrink-0 tabular-nums">
                          <Star className="size-3 fill-current" aria-hidden />
                          {barber.rating.toFixed(1)}
                        </Badge>
                      ) : null}
                    </div>
                  </CardHeader>
                  <CardContent className="flex h-full flex-col justify-between gap-4">
                    {location || barber?.district ? (
                      <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
                        <MapPin className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                        {location || barber?.district}
                      </p>
                    ) : null}
                    <div className="flex gap-2">
                      <Link
                        href={`/book?barber=${item.barber}`}
                        className={cn(buttonVariants({ size: "sm" }), "h-9 flex-1 rounded-xl")}
                      >
                        <Scissors className="size-3.5" aria-hidden />
                        <T k="favorites.quickBook" />
                      </Link>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-9 rounded-xl"
                        aria-label={`${t("common.remove")} ${name}`}
                        disabled={remove.isPending}
                        onClick={() => onRemove(item.barber)}
                      >
                        <Trash2 className="size-3.5" aria-hidden />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </ClientGate>
  );
}
