import Link from "next/link";

import { T } from "@/components/i18n/t";
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
          <CardTitle><T k="error.notFoundTitle" /></CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm leading-relaxed text-muted-foreground">
            <T k="error.notFoundBody" />
          </p>
          <div className="flex gap-2">
            <Link href="/" className={buttonVariants({ size: "sm" })}>
              <T k="error.home" />
            </Link>
            <Link
              href="/barbers"
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              <T k="nav.barbers" />
            </Link>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
