import crypto from "node:crypto";
import fs from "node:fs";
import { Account, Client, Databases, Users } from "node-appwrite";

/**
 * End-to-end auth probe. Requires a running dev server and a filled
 * `.env`. Creates throwaway users and deletes them again.
 */
const env = Object.fromEntries(
  fs
    .readFileSync(".env", "utf8")
    .split(/\r?\n/)
    .filter((line) => line.includes("=") && !line.trim().startsWith("#"))
    .map((line) => {
      const index = line.indexOf("=");
      return [line.slice(0, index).trim(), line.slice(index + 1).trim()];
    }),
);

const BASE = env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const ORIGIN = BASE;
const endpoint = env.APPWRITE_ENDPOINT;
const project = env.APPWRITE_PROJECT_ID;
const key = env.APPWRITE_API_KEY;
const botToken = env.TELEGRAM_BOT_TOKEN;

const admin = new Client().setEndpoint(endpoint).setProject(project).setKey(key);
const users = new Users(admin);
const db = new Databases(admin);

async function deleteProfile(userId) {
  await db
    .deleteDocument({
      databaseId: env.APPWRITE_DATABASE_ID,
      collectionId: "users",
      documentId: userId,
    })
    .catch(() => {});
}

const results = [];
function check(name, condition, extra = "") {
  results.push({ name, ok: Boolean(condition), extra });
  console.log(`${condition ? "PASS" : "FAIL"}  ${name}${extra ? " — " + extra : ""}`);
}

async function waitForServer() {
  for (let i = 0; i < 40; i += 1) {
    try {
      const res = await fetch(BASE, { redirect: "manual" });
      if (res.status < 500) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 750));
  }
  throw new Error("dev server did not start");
}

function cookieValue(setCookie, name) {
  const jar = Array.isArray(setCookie) ? setCookie : [setCookie];
  for (const entry of jar) {
    if (!entry) continue;
    const [pair] = entry.split(";");
    const [keyName, ...rest] = pair.split("=");
    if (keyName.trim() === name) return rest.join("=");
  }
  return null;
}

await waitForServer();

const home = await fetch(BASE);
const homeHtml = await home.text();
check("GET /", home.status === 200, String(home.status));
check("landing renders hero", homeHtml.includes("Your chair is"));
check("landing has sign-in CTA", homeHtml.includes("/sign-in"));

const signIn = await fetch(`${BASE}/sign-in`);
const signInHtml = await signIn.text();
check("GET /sign-in", signIn.status === 200, String(signIn.status));
check("sign-in renders form copy", signInHtml.includes("Welcome to icone"));

const anonAccount = await fetch(`${BASE}/account`, { redirect: "manual" });
check(
  "GET /account unauthenticated returns a real redirect",
  anonAccount.status === 307 &&
    (anonAccount.headers.get("location") ?? "").includes("/sign-in?next="),
  `${anonAccount.status} ${anonAccount.headers.get("location") ?? ""}`,
);

// --- email start ---
const email = `icone.qa.${Date.now()}@mailinator.com`;
const startRes = await fetch(`${BASE}/api/auth/email/start`, {
  method: "POST",
  headers: { "Content-Type": "application/json", Origin: ORIGIN },
  body: JSON.stringify({ email }),
});
const startBody = await startRes.json();
const otpCookie = cookieValue(startRes.headers.getSetCookie(), "icone_otp");
check("POST /api/auth/email/start", startRes.status === 200 && startBody.ok, String(startRes.status));
check("email start sets HttpOnly OTP cookie", Boolean(otpCookie));

const badVerify = await fetch(`${BASE}/api/auth/email/verify`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Origin: ORIGIN,
    Cookie: `icone_otp=${otpCookie}`,
  },
  body: JSON.stringify({ code: "000000" }),
});
const badVerifyBody = await badVerify.json();
check(
  "POST /api/auth/email/verify rejects bad code",
  badVerify.status === 400 && badVerifyBody?.error?.code === "invalid_code",
  `${badVerify.status} ${badVerifyBody?.error?.code ?? ""}`,
);

const badOrigin = await fetch(`${BASE}/api/auth/email/start`, {
  method: "POST",
  headers: { "Content-Type": "application/json", Origin: "https://evil.example" },
  body: JSON.stringify({ email }),
});
check("cross-origin POST rejected", badOrigin.status === 403, String(badOrigin.status));

// Full email sign-in. Appwrite returns the 6-digit secret to the API key
// holder, which stands in for the user reading their inbox.
if (otpCookie) {
  const token = await new Account(admin).createEmailToken({
    userId: otpCookie,
    email,
  });

  const verifyRes = await fetch(`${BASE}/api/auth/email/verify`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: ORIGIN,
      Cookie: `icone_otp=${otpCookie}`,
    },
    body: JSON.stringify({ code: token.secret }),
  });
  const verifyBody = await verifyRes.json();
  const emailSession = cookieValue(
    verifyRes.headers.getSetCookie(),
    "icone_session",
  );
  check(
    "POST /api/auth/email/verify with a real code",
    verifyRes.status === 200 && verifyBody.ok === true,
    `${verifyRes.status} ${verifyBody?.error?.code ?? ""}`,
  );
  check("email verify sets the session cookie", Boolean(emailSession));

  const emailAccount = await fetch(`${BASE}/account`, {
    headers: { Cookie: `icone_session=${emailSession}` },
  });
  const emailAccountHtml = await emailAccount.text();
  check(
    "email session renders the account",
    emailAccount.status === 200 &&
      emailAccountHtml.includes("icone.qa.") &&
      emailAccountHtml.includes("Email"),
    String(emailAccount.status),
  );

  const emailLogout = await fetch(`${BASE}/api/auth/logout`, {
    method: "POST",
    headers: { Origin: ORIGIN, Cookie: `icone_session=${emailSession}` },
  });
  check("email session signs out", emailLogout.status === 200, String(emailLogout.status));
}

// Clean up the email user created by Appwrite.
if (otpCookie) {
  try {
    await deleteProfile(otpCookie);
    await users.delete({ userId: otpCookie });
    check("email QA user cleaned up", true);
  } catch (error) {
    check("email QA user cleaned up", false, String(error?.message ?? error));
  }
}

// --- telegram ---
const tgId = "999000112";
const payload = {
  id: tgId,
  first_name: "Probe",
  last_name: "Telegram",
  username: "probe_tg",
  auth_date: String(Math.floor(Date.now() / 1000)),
};
const dataCheck = Object.keys(payload)
  .sort()
  .map((k) => `${k}=${payload[k]}`)
  .join("\n");
const secretKey = crypto.createHash("sha256").update(botToken).digest();
const hash = crypto.createHmac("sha256", secretKey).update(dataCheck).digest("hex");
const search = new URLSearchParams({ ...payload, hash });

const tgRes = await fetch(`${BASE}/api/auth/telegram/callback?${search}`, {
  redirect: "manual",
});
const tgCookie = cookieValue(tgRes.headers.getSetCookie(), "icone_session");
check(
  "GET /api/auth/telegram/callback",
  tgRes.status === 303 && tgRes.headers.get("location")?.endsWith("/start"),
  `${tgRes.status} ${tgRes.headers.get("location") ?? ""}`,
);
check("telegram callback sets session cookie", Boolean(tgCookie));

const accountRes = await fetch(`${BASE}/account`, {
  headers: { Cookie: `icone_session=${tgCookie}` },
});
const accountHtml = await accountRes.text();
check("GET /account with session", accountRes.status === 200, String(accountRes.status));
check("account shows Telegram name", accountHtml.includes("Probe Telegram"));

const badTg = await fetch(
  `${BASE}/api/auth/telegram/callback?id=${tgId}&first_name=Probe&auth_date=${payload.auth_date}&hash=deadbeef`,
  { redirect: "manual" },
);
check(
  "telegram callback rejects bad hash",
  badTg.status === 303 &&
    (badTg.headers.get("location") ?? "").includes("error=telegram"),
  badTg.headers.get("location") ?? "",
);

const logout = await fetch(`${BASE}/api/auth/logout`, {
  method: "POST",
  headers: { Origin: ORIGIN, Cookie: `icone_session=${tgCookie}` },
});
check("POST /api/auth/logout", logout.status === 200, String(logout.status));

const afterLogout = await fetch(`${BASE}/account`, {
  redirect: "manual",
  headers: { Cookie: `icone_session=${tgCookie}` },
});
const afterLogoutHtml = await afterLogout.text();
check(
  "revoked session no longer renders account data",
  !afterLogoutHtml.includes("Your chair is one release away") &&
    !afterLogoutHtml.includes("Sign out") &&
    afterLogoutHtml.includes("/sign-in?next=%2Faccount"),
  String(afterLogout.status),
);

try {
  await deleteProfile(`tg_${tgId}`);
  await users.delete({ userId: `tg_${tgId}` });
  check("telegram QA user cleaned up", true);
} catch (error) {
  check("telegram QA user cleaned up", false, String(error?.message ?? error));
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
