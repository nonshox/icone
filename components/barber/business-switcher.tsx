"use client";

import { Building2, Check, ChevronDown, MapPin } from "lucide-react";
import { useSyncExternalStore, useState } from "react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useT } from "@/lib/i18n/use-t";
import { cn } from "@/lib/utils";

/**
 * Serializable view of the business root. The server resolves the stable
 * default and the full option list; this component only changes what the
 * owner/manager is looking at. It never writes server data.
 */
export type SwitcherBusiness = {
  id: string;
  name: string;
  branch?: { id: string; name: string };
};

export type SwitcherOption = {
  id: string;
  name: string;
  branches: { id: string; name: string }[];
};

const BUSINESS_COOKIE = "icone_business";
const BRANCH_COOKIE = "icone_branch";
const MAX_AGE = 60 * 60 * 24 * 30;

/** Plain cookies, never a session or an authorization input. */
function readCookie(name: string): string {
  if (typeof document === "undefined") return "";
  const hit = document.cookie
    .split("; ")
    .find((entry) => entry.startsWith(`${name}=`));
  return hit ? decodeURIComponent(hit.slice(name.length + 1)) : "";
}

function writeCookie(name: string, value: string) {
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${MAX_AGE}; samesite=lax`;
}

function clearCookie(name: string) {
  document.cookie = `${name}=; path=/; max-age=0; samesite=lax`;
}

/** The cookies do not publish events; a click updates `override` locally. */
const noSubscribe = () => () => {};

/** A valid, stable string snapshot: invalid or stale cookies fall back. */
function cookieKey(options: SwitcherOption[]): string {
  if (typeof document === "undefined") return "";
  const business = options.find((row) => row.id === readCookie(BUSINESS_COOKIE));
  if (!business) return "";
  const branch = readCookie(BRANCH_COOKIE);
  return `${business.id}|${
    business.branches.some((row) => row.id === branch) ? branch : ""
  }`;
}

export function BusinessSwitcher({
  active,
  options,
}: {
  active: SwitcherBusiness | null;
  options: SwitcherOption[];
}) {
  const t = useT();
  const serverKey = `${active?.id ?? options[0]?.id ?? ""}|${active?.branch?.id ?? ""}`;
  // Hydration uses the server default; afterwards the browser snapshot
  // picks up a saved cookie without an effect or a state update in render.
  const storedKey = useSyncExternalStore(
    noSubscribe,
    () => cookieKey(options),
    () => serverKey,
  );
  const [override, setOverride] = useState<string | null>(null);
  const key = override ?? (storedKey || serverKey);
  const [businessId, branchId] = key.split("|");

  const option = options.find((row) => row.id === businessId);
  const branch = option?.branches.find((row) => row.id === branchId);
  const label =
    [option?.name ?? active?.name ?? "", branch?.name ?? active?.branch?.name ?? ""]
      .filter(Boolean)
      .join(" · ") || t("nav.business");

  function choose(target: SwitcherOption, branch = "") {
    writeCookie(BUSINESS_COOKIE, target.id);
    if (branch) writeCookie(BRANCH_COOKIE, branch);
    else clearCookie(BRANCH_COOKIE);
    setOverride(`${target.id}|${branch}`);
  }

  if (options.length === 0) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={t("work.dashboard.locationTitle")}
        className="inline-flex max-w-[16rem] items-center gap-1.5 rounded-xl border border-border bg-background/60 px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-brand/10 focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Building2 className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        <span className="truncate">{label}</span>
        <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-60">
        {options.map((target, index) => (
          <div key={target.id}>
            {index > 0 ? <DropdownMenuSeparator /> : null}
            <DropdownMenuGroup>
              <DropdownMenuLabel className="truncate">{target.name}</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => choose(target)}>
                <Check
                  className={cn(
                    "size-4",
                    businessId === target.id && !branchId ? "" : "opacity-0",
                  )}
                  aria-hidden
                />
                <Building2 className="size-4 text-muted-foreground" aria-hidden />
                <span className="truncate">{target.name}</span>
              </DropdownMenuItem>
              {target.branches.map((row) => (
                <DropdownMenuItem key={row.id} onClick={() => choose(target, row.id)}>
                  <Check
                    className={cn(
                      "size-4",
                      businessId === target.id && branchId === row.id ? "" : "opacity-0",
                    )}
                    aria-hidden
                  />
                  <MapPin className="size-4 text-muted-foreground" aria-hidden />
                  <span className="truncate">{row.name}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
          </div>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
