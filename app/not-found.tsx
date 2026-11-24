import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function NotFound() {
  return (
    <main
      id="main"
      className="mx-auto flex min-h-dvh w-full max-w-md items-center px-6"
    >
      <Card className="w-full">
        <CardHeader>
          <CardTitle>404 — nothing here</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm leading-relaxed text-muted-foreground">
            The page you were looking for does not exist or has moved.
          </p>
          <div className="flex gap-2">
            <Link href="/" className={buttonVariants({ size: "sm" })}>
              Back home
            </Link>
            <Link
              href="/barbers"
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              Browse barbers
            </Link>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
