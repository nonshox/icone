"use client";

import { Search } from "lucide-react";
import Link from "next/link";
import { useDeferredValue, useMemo, useState } from "react";

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
import type { Barber } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

export function BarberDirectory({ barbers }: { barbers: Barber[] }) {
  const [query, setQuery] = useState("");
  const [title, setTitle] = useState("all");
  const deferredQuery = useDeferredValue(query);

  const titles = useMemo(
    () => [...new Set(barbers.map((barber) => barber.title).filter(Boolean))],
    [barbers],
  );

  const visible = useMemo(() => {
    const needle = deferredQuery.trim().toLowerCase();

    return barbers.filter((barber) => {
      const matchesTitle = title === "all" || barber.title === title;
      const matchesQuery =
        !needle ||
        `${barber.name} ${barber.title} ${barber.bio}`.toLowerCase().includes(needle);
      return matchesTitle && matchesQuery;
    });
  }, [barbers, deferredQuery, title]);

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-[1fr_200px]">
        <div className="space-y-2">
          <Label htmlFor="barber-search">Search</Label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              id="barber-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Name or style"
              className="h-9 pl-9"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="barber-title">Speciality</Label>
          <Select value={title} onValueChange={(value) => setTitle(String(value))}>
            <SelectTrigger id="barber-title" className="h-9 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All barbers</SelectItem>
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
            No barbers match that search.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((barber) => (
            <Card key={barber.id} size="sm" className="h-full">
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <CardTitle className="truncate">{barber.name}</CardTitle>
                    <CardDescription className="truncate">
                      {barber.title || "Barber"}
                    </CardDescription>
                  </div>
                  {barber.rating > 0 ? (
                    <Badge variant="secondary">
                      {barber.rating.toFixed(1)} ★
                    </Badge>
                  ) : null}
                </div>
              </CardHeader>
              <CardContent className="flex h-full flex-col justify-between gap-4">
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {barber.bio || "Precision cuts and a calm chair."}
                </p>
                <Link
                  href={`/barbers/${barber.id}`}
                  className={cn(
                    buttonVariants({ variant: "outline", size: "sm" }),
                    "w-full rounded-lg",
                  )}
                >
                  View profile
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
