"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { useState, type ReactNode } from "react";

import { TelegramAutoSignIn } from "@/components/auth/telegram-auto-sign-in";
import { LocaleInitializer } from "@/components/i18n/locale-initializer";
import { Toaster } from "@/components/ui/sonner";

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            retry: 1,
            refetchOnWindowFocus: true,
          },
        },
      }),
  );

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <QueryClientProvider client={queryClient}>
        <TelegramAutoSignIn />
        <LocaleInitializer />
        {children}
        <Toaster position="top-center" />
      </QueryClientProvider>
    </ThemeProvider>
  );
}
