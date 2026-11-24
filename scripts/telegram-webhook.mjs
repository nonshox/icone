/**
 * Manage the Telegram bot webhook.
 *
 *   node scripts/telegram-webhook.mjs info   # read current state (default)
 *   node scripts/telegram-webhook.mjs set    # point it at this app
 *   node scripts/telegram-webhook.mjs delete
 *
 * Reads credentials from .env.local. Never prints the bot token or secret.
 */
import fs from "node:fs";
import dns from "node:dns";

// Telegram resolves to IPv6 first here, which the runtime resets. Prefer IPv4.
dns.setDefaultResultOrder("ipv4first");

function readEnv(file) {
  return Object.fromEntries(
    fs
      .readFileSync(file, "utf8")
      .split(/\r?\n/)
      .filter((line) => line.includes("=") && !line.trim().startsWith("#"))
      .map((line) => {
        const index = line.indexOf("=");
        return [line.slice(0, index).trim(), line.slice(index + 1).trim()];
      }),
  );
}

const env = readEnv(".env.local");
// Webhooks must point at a public HTTPS host, never at localhost.
const siteUrl =
  process.env.NEXT_PUBLIC_APP_URL ??
  readEnv(".env.production").NEXT_PUBLIC_APP_URL ??
  env.NEXT_PUBLIC_APP_URL;
const action = process.argv[2] ?? "info";
const api = (method) => `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/${method}`;

async function call(method, body) {
  const response = await fetch(api(method), {
    method: body ? "POST" : "GET",
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await response.json().catch(() => null);

  if (!response.ok || !data?.ok) {
    throw new Error(
      `${method} failed (${response.status}): ${data?.description ?? "no response"}`,
    );
  }

  return data.result;
}

function printInfo(result) {
  console.log(`url:                ${result.url || "(none)"}`);
  console.log(`pending updates:    ${result.pending_update_count ?? 0}`);
  console.log(`has certificate:    ${result.has_custom_certificate ?? false}`);
  console.log(`max connections:    ${result.max_connections ?? "-"}`);
  console.log(`allowed updates:    ${(result.allowed_updates ?? []).join(", ") || "-"}`);
  console.log(`secret configured:  ${result.secret_token ? "yes" : "unknown"}`);
  if (result.last_error_date) {
    console.log(`last error:         ${result.last_error_message ?? "unknown"}`);
  }
}

if (action === "info") {
  printInfo(await call("getWebhookInfo"));
} else if (action === "set") {
  const url = `${siteUrl}/api/telegram/webhook`;
  const result = await call("setWebhook", {
    url,
    secret_token: env.TELEGRAM_WEBHOOK_SECRET,
    allowed_updates: ["message"],
    drop_pending_updates: false,
  });
  console.log(`setWebhook: ${result ? "ok" : "failed"}`);
  printInfo(await call("getWebhookInfo"));
} else if (action === "delete") {
  console.log(`deleteWebhook: ${(await call("deleteWebhook")) ? "ok" : "failed"}`);
  printInfo(await call("getWebhookInfo"));
} else {
  console.error("Usage: node scripts/telegram-webhook.mjs [info|set|delete]");
  process.exit(1);
}
