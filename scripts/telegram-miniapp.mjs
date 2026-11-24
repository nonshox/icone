/**
 * Configure the bot's menu button to open the icone Mini App.
 *
 *   node scripts/telegram-miniapp.mjs info   # current button (default)
 *   node scripts/telegram-miniapp.mjs set    # open /mini
 *   node scripts/telegram-miniapp.mjs reset  # back to the default button
 *
 * Reads credentials from .env.local and the public host from .env.production.
 */
import fs from "node:fs";
import dns from "node:dns";

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

function printButton(button) {
  console.log(`type: ${button?.type ?? "default"}`);
  if (button?.text) console.log(`text: ${button.text}`);
  if (button?.web_app?.url) console.log(`url:  ${button.web_app.url}`);
}

if (action === "info") {
  printButton(await call("getChatMenuButton"));
} else if (action === "set") {
  const url = `${siteUrl}/mini`;
  const button = {
    type: "web_app",
    text: "icone",
    web_app: { url },
  };
  console.log(`setChatMenuButton: ${(await call("setChatMenuButton", { menu_button: button })) ? "ok" : "failed"}`);
  printButton(await call("getChatMenuButton"));
} else if (action === "reset") {
  console.log(`reset: ${(await call("setChatMenuButton", { menu_button: { type: "default" } })) ? "ok" : "failed"}`);
  printButton(await call("getChatMenuButton"));
} else {
  console.error("Usage: node scripts/telegram-miniapp.mjs [info|set|reset]");
  process.exit(1);
}
