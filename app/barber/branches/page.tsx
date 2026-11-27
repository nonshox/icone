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
import { can, getActor } from "@/lib/domain/access";
import { listBranches } from "@/lib/domain/business";
import { listMemberships } from "@/lib/domain/team";

export const metadata: Metadata = {
  title: "Branches",
  robots: { index: false, follow: false },
};

async function BranchesPanel() {
  const actor = await getActor();
  if (!actor) return null;

  const business = actor.owns[0] ?? actor.memberships[0]?.business ?? "";
  if (!business) {
    return (
      <Card className="glass">
        <CardContent className="py-8 text-sm text-muted-foreground">
          <T k="work.branches.noBusiness" />
        </CardContent>
      </Card>
    );
  }
  if (!can(actor, "branch.read", { business })) {
    return (
      <Card className="glass">
        <CardContent className="py-8 text-sm text-muted-foreground">
          <T k="work.branches.denied" />
        </CardContent>
      </Card>
    );
  }

  const [branches, memberships] = await Promise.all([
    listBranches(business),
    listMemberships(business),
  ]);

  return (
    <Card className="glass">
      <CardHeader>
        <CardTitle>
          <T k="nav.branches" />
        </CardTitle>
        <CardDescription>
          <T k="work.branches.hint" />
        </CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        {branches.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            <T k="work.branches.empty" />
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  <T k="common.name" />
                </TableHead>
                <TableHead>
                  <T k="work.branches.address" />
                </TableHead>
                <TableHead>
                  <T k="common.phone" />
                </TableHead>
                <TableHead>
                  <T k="nav.team" />
                </TableHead>
                <TableHead>
                  <T k="common.status" />
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {branches.map((branch) => (
                <TableRow key={branch.id}>
                  <TableCell className="font-medium">
                    <span className="flex flex-wrap items-center gap-2">
                      {branch.name}
                      {branch.primary ? (
                        <Badge variant="secondary">
                          <T k="work.branches.primary" />
                        </Badge>
                      ) : null}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {[branch.address, branch.district, branch.city]
                      .filter(Boolean)
                      .join(", ") || "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {branch.phone || "—"}
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {
                      memberships.filter(
                        (row) =>
                          row.branch === branch.id && row.state === "active",
                      ).length
                    }
                  </TableCell>
                  <TableCell>
                    <Badge variant={branch.active ? "secondary" : "outline"}>
                      <T k={branch.active ? "common.open" : "work.services.hidden"} />
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

export default function BranchesPage() {
  return (
    <BarberShell title="Branches" description="Where your team works.">
      <Suspense fallback={<BarberSkeleton />}>
        <BranchesPanel />
      </Suspense>
    </BarberShell>
  );
}
