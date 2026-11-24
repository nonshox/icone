import "server-only";

import { z } from "zod";

/**
 * Server-only environment.
 *
 * Validated lazily so `next build` can prerender public pages without a full
 * server environment. Anything that touches Appwrite calls `serverEnv()` first
 * and fails loudly (server-side) when a value is missing.
 */
const serverEnvSchema = z.object({
  APPWRITE_ENDPOINT: z.string().url(),
  APPWRITE_PROJECT_ID: z.string().min(1),
  APPWRITE_API_KEY: z.string().min(1),
  APPWRITE_DATABASE_ID: z.string().min(1),
  APPWRITE_BUCKET_ID: z.string().min(1),
  TELEGRAM_BOT_TOKEN: z.string().min(1),
  TELEGRAM_WEBHOOK_SECRET: z.string().min(16),
  CRON_SECRET: z.string().min(16).optional(),
  NEXT_PUBLIC_APP_VERSION: z.string().max(32).default("1.0.0"),
  NEXT_PUBLIC_APP_URL: z.string().url().default("https://icone-uz.vercel.app"),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

let cached: ServerEnv | null = null;

export function serverEnv(): ServerEnv {
  if (cached) return cached;

  const parsed = serverEnvSchema.safeParse(process.env);

  if (!parsed.success) {
    const missing = parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("\n");

    throw new Error(
      `Invalid or missing server environment variables:\n${missing}\n` +
        "Check your .env against .env.example.",
    );
  }

  cached = parsed.data;
  return cached;
}
