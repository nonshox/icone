import type { Metadata } from "next";
import { Suspense } from "react";

import { BarberShell, BarberSkeleton } from "@/components/barber/barber-shell";
import { T } from "@/components/i18n/t";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getProfiles } from "@/lib/domain/account";
import { can, getActor } from "@/lib/domain/access";
import { listBranches } from "@/lib/domain/business";
import { getBarbers } from "@/lib/domain/professional";
import { listMemberships } from "@/lib/domain/team";

export const metadata: Metadata = {
  title: "Team",
  robots: { index: false, follow: false },
};

function shortId(id: string): string {
  return id ? id.slice(0, 8) : "—";
}

async function TeamPanel() {
  const actor = await getActor();
  if (!actor) return null;

  const business = actor.owns[0] ?? actor.memberships[0]?.business ?? "";
  if (!business) {
    return (
      <Card className="glass">
        <CardContent className="py-8 text-sm text-muted-foreground">
          <T k="work.team.noBusiness" />
        </CardContent>
      </Card>
    );
  }
  if (!can(actor, "team.read", { business })) {
    return (
      <Card className="glass">
        <CardContent className="py-8 text-sm text-muted-foreground">
          <T k="work.team.denied" />
        </CardContent>
      </Card>
    );
  }

  const memberships = await listMemberships(business);
  const [profiles, barbers, branches] = await Promise.all([
    getProfiles([...new Set(memberships.map((row) => row.user).filter(Boolean))]),
    getBarbers([
      ...new Set(memberships.map((row) => row.barber).filter(Boolean)),
    ]),
    listBranches(business),
  ]);

  return (
    <Card className="glass">
      <CardHeader>
        <CardTitle>
          <T k="nav.team" />
        </CardTitle>
        <CardDescription>
          <T k="work.team.hint" />
        </CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        {memberships.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            <T k="work.team.empty" />
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  <T k="common.member" />
                </TableHead>
                <TableHead>
                  <T k="work.team.role" />
                </TableHead>
                <TableHead>
                  <T k="work.staff.chair" />
                </TableHead>
                <TableHead>
                  <T k="work.team.branch" />
                </TableHead>
                <TableHead>
                  <T k="work.team.state" />
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {memberships.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">
                    {profiles.get(row.user)?.name ?? shortId(row.user)}
                  </TableCell>
                  <TableCell>{row.role}</TableCell>
                  <TableCell>
                    {barbers.get(row.barber)?.name ?? "—"}
                  </TableCell>
                  <TableCell>
                    {branches.find((branch) => branch.id === row.branch)?.name ??
                      "—"}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={row.state === "active" ? "secondary" : "outline"}
                    >
                      {row.state}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

export default function TeamPage() {
  return (
    <BarberShell title="Team" description="People who work with you.">
      <Suspense fallback={<BarberSkeleton />}>
        <TeamPanel />
      </Suspense>
    </BarberShell>
  );
}
