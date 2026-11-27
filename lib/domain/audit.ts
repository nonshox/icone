import "server-only";

import { Query } from "node-appwrite";

import { TABLES } from "@/lib/appwrite/db";

import { clean, create, list, str, type Row } from "./crud";

/**
 * Append-only audit trail.
 *
 * Every sensitive operation — approving an application, suspending an
 * account, changing a role, moderating a review — writes one row here. The
 * trail is never edited or deleted, so it stays useful as evidence.
 */

export type AuditAction =
  | "application.submit"
  | "application.approve"
  | "application.reject"
  | "application.request"
  | "application.suspend"
  | "business.verify"
  | "business.suspend"
  | "user.suspend"
  | "user.restore"
  | "role.change"
  | "member.remove"
  | "member.invite"
  | "review.hide"
  | "review.restore"
  | "report.resolve"
  | "ticket.reply"
  | "settings.change"
  | "data.export";

export type AuditInput = {
  actor: string;
  action: AuditAction | string;
  kind?: string;
  target?: string;
  detail?: string;
};

export function toAudit(row: Row): {
  id: string;
  actor: string;
  action: string;
  kind: string;
  target: string;
  detail: string;
  at: string;
} {
  return {
    id: row.$id,
    actor: str(row.actor),
    action: str(row.action),
    kind: str(row.kind),
    target: str(row.target),
    detail: str(row.detail),
    at: row.$createdAt,
  };
}

/** Record one event. Never throws: an audit failure must not fail the action. */
export async function audit(input: AuditInput): Promise<void> {
  try {
    await create(TABLES.audit, {
      actor: input.actor,
      action: clean(input.action, 48),
      kind: clean(input.kind ?? "", 24),
      target: clean(input.target ?? "", 36),
      detail: clean(input.detail ?? "", 512),
    });
  } catch (error) {
    console.error("[audit] write failed", error);
  }
}

export type AuditFilter = {
  action?: string;
  actor?: string;
  kind?: string;
  target?: string;
  limit?: number;
};

export async function listAudit(filter: AuditFilter = {}): Promise<ReturnType<typeof toAudit>[]> {
  const queries: string[] = [];
  if (filter.action) queries.push(Query.equal("action", filter.action));
  if (filter.actor) queries.push(Query.equal("actor", filter.actor));
  if (filter.kind) queries.push(Query.equal("kind", filter.kind));
  if (filter.target) queries.push(Query.equal("target", filter.target));

  const rows = await list(TABLES.audit, [
    ...queries,
    Query.orderDesc("$createdAt"),
    Query.limit(Math.min(200, filter.limit ?? 100)),
  ]);

  return rows.map(toAudit);
}

/** Everything that happened to one record, newest first. */
export async function auditFor(kind: string, target: string): Promise<ReturnType<typeof toAudit>[]> {
  return listAudit({ kind, target });
}

/** Distinct actions seen so far — powers the filter dropdown for free. */
export async function auditActions(): Promise<string[]> {
  const rows = await list(TABLES.audit, [Query.limit(200)]);
  return [...new Set(rows.map((row) => str(row.action)))].sort();
}
