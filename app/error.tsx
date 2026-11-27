"use client";

import { useEffect } from "react";

import { T } from "@/components/i18n/t";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app] route error", error);
  }, [error]);

  return (
    <main
      id="main"
      className="mx-auto flex min-h-dvh w-full max-w-md items-center px-6"
    >
      <Card className="w-full">
        <CardHeader>
          <CardTitle><T k="error.title" /></CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm leading-relaxed text-muted-foreground">
            <T k="error.body" />
          </p>
          <div className="flex gap-2">
            <Button type="button" onClick={reset}>
              <T k="common.tryAgain" />
            </Button>
            <Link href="/" className={buttonVariants({ variant: "outline" })}>
              <T k="error.home" />
            </Link>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
