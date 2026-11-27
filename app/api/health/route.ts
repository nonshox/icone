import "server-only";

import { Users } from "node-appwrite";
import { NextResponse } from "next/server";

import { TABLES } from "@/lib/appwrite/db";
import { createAdminClient } from "@/lib/appwrite/server";
import { list } from "@/lib/domain/crud";
import { serverEnv } from "@/lib/env";

/**
 * GET /api/health — production readiness probe.
 * Checks configuration and that both Appwrite services respond.
 * Never includes secrets or document contents.
 */
export async function GET() {
  const started = Date.now();

  let config = true;
  try {
    serverEnv();
  } catch {
    config = false;
  }

  const [users, database] = await Promise.allSettled([
    new Users(createAdminClient()).list({ queries: [], total: true }),
    list(TABLES.users, []),
  ]);

  const checks = {
    config,
    auth: users.status === "fulfilled",
    database: database.status === "fulfilled",
  };
  const healthy = Object.values(checks).every(Boolean);

  return NextResponse.json(
    {
      ok: healthy,
      service: "icone",
      version: process.env.NEXT_PUBLIC_APP_VERSION ?? "1.0.0",
      checks,
      elapsedMs: Date.now() - started,
    },
    { status: healthy ? 200 : 503 },
  );
}
