/** Shared helpers for the QA probes. Telegram is the only sign-in method. */
import fs from "node:fs";
import crypto from "node:crypto";

export const env = Object.fromEntries(
  fs
    .readFileSync(".env", "utf8")
    .split(/\r?\n/)
    .filter((line) => line.includes("=") && !line.trim().startsWith("#"))
    .map((line) => {
      const i = line.indexOf("=");
      return [line.slice(0, i).trim(), line.slice(i + 1).trim()];
    }),
);

export const BASE = env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export function cookieValue(cookies, name) {
  for (const item of cookies ?? []) {
    const [pair] = item.split(";");
    const [key, ...rest] = pair.trim().split("=");
    if (key === name) return rest.join("=");
  }
  return "";
}

/** Create a signed Mini App payload and exchange it for a web session. */
export async function signIn(label = "qa") {
  const tgId = String(Date.now() + Math.floor(Math.random() * 1000)).slice(-12);
  const params = {
    auth_date: String(Math.floor(Date.now() / 1000)),
    user: JSON.stringify({
      id: Number(tgId),
      first_name: `QA ${label}`,
      username: `qa_${label}_${tgId}`,
    }),
  };

  const checkString = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join("\n");
  const secretKey = crypto
    .createHmac("sha256", "WebAppData")
    .update(env.TELEGRAM_BOT_TOKEN)
    .digest();
  const initData = new URLSearchParams({
    ...params,
    hash: crypto.createHmac("sha256", secretKey).update(checkString).digest("hex"),
  }).toString();

  const response = await fetch(`${BASE}/api/auth/telegram/mini`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ initData }),
  });
  const body = await response.json().catch(() => null);
  if (!response.ok || !body?.ok) {
    throw new Error(`QA sign-in failed: ${response.status} ${body?.error?.code ?? ""}`);
  }

  return {
    id: `tg_${tgId}`,
    secret: cookieValue(response.headers.getSetCookie(), "icone_session"),
  };
}

export async function call(path, { method = "GET", body, secret } = {}) {
  const response = await fetch(`${BASE}${path}`, {
    method,
    redirect: "manual",
    headers: {
      ...(secret ? { cookie: `icone_session=${secret}` } : {}),
      ...(body ? { "content-type": "application/json", origin: BASE } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return {
    status: response.status,
    json: await response.json().catch(() => null),
  };
}
