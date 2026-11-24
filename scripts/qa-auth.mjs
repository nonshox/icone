/**
 * Telegram-only auth probe.
 *   node qa-auth.mjs
 */
import crypto from "node:crypto";
import { Client, Databases, Users } from "node-appwrite";

import { BASE, call, cookieValue, env, signIn } from "./qa-telegram.mjs";

const admin = new Client()
  .setEndpoint(env.APPWRITE_ENDPOINT)
  .setProject(env.APPWRITE_PROJECT_ID)
  .setKey(env.APPWRITE_API_KEY);
const users = new Users(admin);
const db = new Databases(admin);

const results = [];
function check(name, condition, extra = "") {
  results.push({ name, ok: Boolean(condition) });
  console.log(`${condition ? "PASS" : "FAIL"}  ${name}${extra ? " — " + extra : ""}`);
}

function widgetQuery(id, hash) {
  return new URLSearchParams({
    id: String(id),
    first_name: "QA",
    auth_date: String(Math.floor(Date.now() / 1000)),
    hash,
  }).toString();
}

function signedWidgetQuery(id) {
  const params = {
    id: String(id),
    first_name: "QA",
    auth_date: String(Math.floor(Date.now() / 1000)),
  };
  const checkString = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join("\n");
  const key = crypto.createHash("sha256").update(env.TELEGRAM_BOT_TOKEN).digest();
  return widgetQuery(
    id,
    crypto.createHmac("sha256", key).update(checkString).digest("hex"),
  );
}

const tgId = String(Date.now() + Math.floor(Math.random() * 1000)).slice(-12);
const userId = `tg_${tgId}`;
let session = "";
let extraUserId = "";

try {
  const home = await fetch(BASE);
  const homeHtml = await home.text();
  check("GET /", home.status === 200);
  check(
    "landing renders hero",
    homeHtml.includes("rningiz") || homeHtml.includes("Your chair is"),
  );
  check("landing has sign-in CTA", homeHtml.includes("/sign-in"));

  const signInPage = await fetch(`${BASE}/sign-in`);
  const signInHtml = await signInPage.text();
  check("GET /sign-in", signInPage.status === 200);
  check(
    "sign-in is Telegram only",
    !signInHtml.includes("/api/auth/email/start") &&
      (signInHtml.includes("Telegram") || signInHtml.includes("telegram")),
  );

  const removed = await fetch(`${BASE}/api/auth/email/start`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{}",
  });
  check("email auth endpoint removed", removed.status === 404, `status ${removed.status}`);

  const member = await signIn("auth");
  session = member.secret;
  extraUserId = member.id;
  check("Mini App sign-in sets session", Boolean(session));

  const account = await fetch(`${BASE}/account`, {
    headers: { Cookie: `icone_session=${session}` },
  });
  const accountHtml = await account.text();
  check(
    "session renders the account",
    account.status === 200 && accountHtml.includes("QA auth"),
  );

  const badOrigin = await fetch(`${BASE}/api/auth/telegram/mini`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "https://evil.example",
    },
    body: JSON.stringify({ initData: "x" }),
  });
  check("cross-origin Mini App POST rejected", badOrigin.status === 403);

  const callback = await fetch(
    `${BASE}/api/auth/telegram/callback?${signedWidgetQuery(tgId)}`,
    { redirect: "manual" },
  );
  check(
    "signed widget callback redirects",
    callback.status === 303 &&
      (callback.headers.get("location") ?? "").includes("/start"),
    `${callback.status} ${callback.headers.get("location") ?? ""}`,
  );
  check(
    "widget callback sets cookie",
    Boolean(cookieValue(callback.headers.getSetCookie(), "icone_session")),
  );

  const badCallback = await fetch(
    `${BASE}/api/auth/telegram/callback?${widgetQuery(tgId, "deadbeef")}`,
    { redirect: "manual" },
  );
  check(
    "bad widget hash rejected",
    (badCallback.headers.get("location") ?? "").includes("error=telegram"),
  );

  const logout = await call("/api/auth/logout", { method: "POST", secret: session });
  check("logout", logout.status === 200);

  const after = await fetch(`${BASE}/account`, {
    headers: { Cookie: `icone_session=${session}` },
  });
  const afterHtml = await after.text();
  check(
    "revoked session renders no account data",
    !afterHtml.includes("QA auth"),
  );
} finally {
  for (const id of [userId, extraUserId].filter(Boolean)) {
    await db
      .deleteDocument({
        databaseId: env.APPWRITE_DATABASE_ID,
        collectionId: "users",
        documentId: id,
      })
      .catch(() => {});
    await users.delete({ userId: id }).catch(() => {});
  }
}

const passed = results.filter((result) => result.ok).length;
console.log(`\n${passed}/${results.length} checks passed`);
process.exit(passed === results.length ? 0 : 1);
