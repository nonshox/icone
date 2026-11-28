import Link from "next/link";

import { routeMetadata } from "@/lib/metadata";
import { T } from "@/components/i18n/t";
import { SiteHeader } from "@/components/layout/site-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = routeMetadata({
  path: "/legal/privacy",
  titleKey: "legal.privacy.title",
  descriptionKey: "meta.privacy.description",
});

const sections = [
  { titleKey: "legal.privacy.s1.title", bodyKey: "legal.privacy.s1.body" },
  { titleKey: "legal.privacy.s2.title", bodyKey: "legal.privacy.s2.body" },
  { titleKey: "legal.privacy.s3.title", bodyKey: "legal.privacy.s3.body" },
  { titleKey: "legal.privacy.s4.title", bodyKey: "legal.privacy.s4.body" },
  { titleKey: "legal.privacy.s5.title", bodyKey: "legal.privacy.s5.body" },
  { titleKey: "legal.privacy.s6.title", bodyKey: "legal.privacy.s6.body" },
  { titleKey: "legal.privacy.s7.title", bodyKey: "legal.privacy.s7.body" },
  { titleKey: "legal.privacy.s8.title", bodyKey: "legal.privacy.s8.body" },
] as const;

export default function PrivacyPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />

      <main id="main" className="mx-auto w-full max-w-3xl flex-1 px-6 pt-10 pb-10">
        <div className="space-y-2">
          <p className="text-xs font-medium tracking-[0.18em] text-brand-strong uppercase">
            <T k="legal.eyebrow" />
          </p>
          <h1 className="text-3xl font-semibold tracking-[-0.04em]">
            <T k="legal.privacy.title" />
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
            <CardTitle><T k="legal.privacy.questions.title" /></CardTitle>
            <CardDescription>
              <T k="legal.privacy.questions.body" />
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
            <Link href="/support" className="font-medium text-brand-strong hover:underline">
              <T k="legal.supportLink" />
            </Link>
            <Link href="/legal/terms" className="font-medium text-brand-strong hover:underline">
              <T k="legal.termsLink" />
            </Link>
          </CardContent>
        </Card>
      </main>

    </div>
  );
}
