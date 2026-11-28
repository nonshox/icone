import Link from "next/link";

import { routeMetadata } from "@/lib/metadata";
import { T } from "@/components/i18n/t";
import { SiteHeader } from "@/components/layout/site-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = routeMetadata({
  path: "/legal/terms",
  titleKey: "legal.terms.title",
  descriptionKey: "meta.terms.description",
});

const sections = [
  { titleKey: "legal.terms.s1.title", bodyKey: "legal.terms.s1.body" },
  { titleKey: "legal.terms.s2.title", bodyKey: "legal.terms.s2.body" },
  { titleKey: "legal.terms.s3.title", bodyKey: "legal.terms.s3.body" },
  { titleKey: "legal.terms.s4.title", bodyKey: "legal.terms.s4.body" },
  { titleKey: "legal.terms.s5.title", bodyKey: "legal.terms.s5.body" },
  { titleKey: "legal.terms.s6.title", bodyKey: "legal.terms.s6.body" },
  { titleKey: "legal.terms.s7.title", bodyKey: "legal.terms.s7.body" },
  { titleKey: "legal.terms.s8.title", bodyKey: "legal.terms.s8.body" },
  { titleKey: "legal.terms.s9.title", bodyKey: "legal.terms.s9.body" },
] as const;

export default function TermsPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />

      <main id="main" className="mx-auto w-full max-w-3xl flex-1 px-6 pt-10 pb-10">
        <div className="space-y-2">
          <p className="text-xs font-medium tracking-[0.18em] text-brand-strong uppercase">
            <T k="legal.eyebrow" />
          </p>
          <h1 className="text-3xl font-semibold tracking-[-0.04em]">
            <T k="legal.terms.title" />
          </h1>
          <p className="text-sm text-muted-foreground">
            <T k="legal.updated" />
          </p>
        </div>

        <div className="mt-8 space-y-4">
          {sections.map((section) => (
            <Card key={section.titleKey} size="sm">
              <CardHeader>
                <CardTitle><T k={section.titleKey} /></CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  <T k={section.bodyKey} />
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="mt-8">
          <CardHeader>
            <CardTitle><T k="legal.terms.law.title" /></CardTitle>
            <CardDescription>
              <T k="legal.terms.law.body" />
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
            <Link href="/legal/privacy" className="font-medium text-brand-strong hover:underline">
              <T k="legal.privacyLink" />
            </Link>
            <Link href="/support" className="font-medium text-brand-strong hover:underline">
              <T k="legal.supportLink" />
            </Link>
          </CardContent>
        </Card>
      </main>

    </div>
  );
}
