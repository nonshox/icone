"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n/use-t";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const t = useT();

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="size-9 rounded-xl text-muted-foreground hover:text-foreground"
      aria-label={t("nav.theme")}
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
    >
      <Sun className="hidden size-4 dark:block" aria-hidden />
      <Moon className="size-4 dark:hidden" aria-hidden />
    </Button>
  );
}
