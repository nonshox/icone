import "server-only";

import dns from "node:dns";
import { timingSafeEqual } from "node:crypto";

// Telegram resolves to IPv6 first on some hosts, which resets the connection.
dns.setDefaultResultOrder("ipv4first");

/** Compare Telegram's secret header without leaking its length or content. */
export function isValidSecret(
  provided: string | null,
  expected: string,
): boolean {
  if (!provided) return false;

  const actual = Buffer.from(provided, "utf8");
  const wanted = Buffer.from(expected, "utf8");

  return actual.length === wanted.length && timingSafeEqual(actual, wanted);
}

/** Best-effort bot reply. The webhook stays fast even if Telegram is down. */
export async function sendMessage(
  token: string,
  chatId: number,
  text: string,
  webAppUrl?: string,
): Promise<void> {
  const payload: Record<string, unknown> = { chat_id: chatId, text };

  if (webAppUrl) {
    payload.reply_markup = {
      inline_keyboard: [
        [{ text: "Open icone", web_app: { url: webAppUrl } }],
      ],
    };
  }

  const response = await fetch(
    `https://api.telegram.org/bot${token}/sendMessage`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    },
  );

  if (!response.ok) {
    throw new Error(`sendMessage returned ${response.status}`);
  }
}
