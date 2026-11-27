"use client";

import { Check, Loader2, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  useApplications,
  useDecideApplication,
  type Application,
} from "@/lib/api/application-queries";

export function AdminApplicationsView() {
  const list = useApplications();
  const decide = useDecideApplication();
  const [note, setNote] = useState<Record<string, string>>({});

  function act(item: Application, decision: "approved" | "rejected") {
    decide.mutate(
      { id: item.id, decision, note: note[item.id] ?? "" },
      {
        onSuccess: () => toast.success(decision === "approved" ? "Approved" : "Rejected"),
        onError: (error) =>
          toast.error(error instanceof Error ? error.message : "Try again."),
      },
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Barber applications</CardTitle>
        <CardDescription>Approve or reject new chairs.</CardDescription>
      </CardHeader>
      <CardContent>
        {list.isPending ? (
          <p className="py-6 text-sm text-muted-foreground">Loading…</p>
        ) : list.isError ? (
          <p role="alert" className="py-6 text-sm text-destructive">
            Could not load applications.
          </p>
        ) : (list.data ?? []).length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No applications.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Shop</TableHead>
                <TableHead>City</TableHead>
                <TableHead>State</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(list.data ?? []).map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.name}</TableCell>
                  <TableCell>{item.shop || "—"}</TableCell>
                  <TableCell>{item.city}</TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        ["submitted", "review", "info"].includes(item.state)
                          ? "outline"
                          : item.state === "approved"
                            ? "secondary"
                            : "destructive"
                      }
                    >
                      {item.state}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {["submitted", "review", "info"].includes(item.state) ? (
                      <div className="flex items-center justify-end gap-1">
                        <Input
                          aria-label="Note"
                          value={note[item.id] ?? ""}
                          onChange={(event) =>
                            setNote((current) => ({
                              ...current,
                              [item.id]: event.target.value,
                            }))
                          }
                          placeholder="Note"
                          className="h-8 w-28"
                        />
                        <Button
                          size="xs"
                          disabled={decide.isPending}
                          onClick={() => act(item, "approved")}
                        >
                          <Check className="size-3" aria-hidden /> Approve
                        </Button>
                        <Button
                          size="xs"
                          variant="destructive"
                          disabled={decide.isPending}
                          onClick={() => act(item, "rejected")}
                        >
                          {decide.isPending ? (
                            <Loader2 className="size-3 animate-spin" aria-hidden />
                          ) : (
                            <X className="size-3" aria-hidden />
                          )}
                          Reject
                        </Button>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        {item.note || "—"}
                      </span>
                    )}
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
