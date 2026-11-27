"use client";

import { MapPin, Search, Star } from "lucide-react";
import Link from "next/link";
import { useDeferredValue, useMemo, useState } from "react";

import { T } from "@/components/i18n/t";
import { useT } from "@/lib/i18n/use-t";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { imageUrl } from "@/lib/client/files";
import type { Barber } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

function photoStyle(value: string) {
  const url = imageUrl(value);
  if (!/^https?:\/\//.test(url)) return undefined;
  return { backgroundImage: `url("${url.replace(/"/g, "%22")}")` };
}

export function BarberDirectory({
  barbers,
  initialQuery = "",
}: {
  barbers: Barber[];
  initialQuery?: string;
}) {
  const t = useT();
  const [query, setQuery] = useState(initialQuery);
  const [title, setTitle] = useState("all");
  const deferredQuery = useDeferredValue(query);

  const titles = useMemo(
    () => [...new Set(barbers.map((barber) => barber.title).filter(Boolean))].sort(),
    [barbers],
  );

  const visible = useMemo(() => {
    const needle = deferredQuery.trim().toLowerCase();

    return barbers.filter((barber) => {
      const matchesTitle = title === "all" || barber.title === title;
      const matchesQuery =
        !needle ||
        `${barber.name} ${barber.title} ${barber.bio} ${barber.skills} ${barber.city} ${barber.district}`
          .toLowerCase()
          .includes(needle);
      return matchesTitle && matchesQuery;
    });
  }, [barbers, deferredQuery, title]);

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-[1fr_200px]">
        <div className="space-y-2">
          <Label htmlFor="barber-search"><T k="common.search" /></Label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              id="barber-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("barbers.searchPlaceholder")}
              className="h-9 pl-9"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="barber-title"><T k="barbers.speciality" /></Label>
          <Select value={title} onValueChange={(value) => setTitle(String(value))}>
            <SelectTrigger id="barber-title" className="h-9 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("barbers.all")}</SelectItem>
              {titles.map((item) => (
                <SelectItem key={item} value={item}>
                  {item}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {visible.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            <T k="barbers.noMatch" />
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((barber) => {
            const location = [barber.shop, barber.district, barber.city]
              .filter(Boolean)
              .join(" · ");
            return (
              <Card key={barber.id} size="sm" className="h-full">
                <div
                  aria-hidden
                  className="h-24 w-full bg-muted bg-cover bg-center"
                  style={photoStyle(barber.cover || barber.photo)}
                />
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <CardTitle className="truncate">{barber.name}</CardTitle>
                      <CardDescription className="truncate">
                        {barber.title || t("favorites.barberFallback")}
                      </CardDescription>
                    </div>
                    {barber.rating > 0 ? (
                      <Badge variant="secondary" className="shrink-0 tabular-nums">
                        <Star className="size-3 fill-current" aria-hidden />
                        {barber.rating.toFixed(1)}
                      </Badge>
                    ) : null}
                  </div>
                </CardHeader>
                <CardContent className="flex h-full flex-col justify-between gap-4">
                  <div className="space-y-2">
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      {barber.bio || t("barbers.fallback")}
                    </p>
                    {location ? (
                      <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
                        <MapPin className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                        {location}
                      </p>
                    ) : null}
                  </div>
                  <Link
                    href={`/barbers/${barber.id}`}
                    className={cn(
                      buttonVariants({ variant: "outline", size: "sm" }),
                      "w-full rounded-lg",
                    )}
                  >
                    <T k="barbers.view" />
                  </Link>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
