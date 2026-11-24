import "server-only";

import dns from "node:dns";

// Telegram resolves to IPv6 first on some hosts, which resets the connection.
dns.setDefaultResultOrder("ipv4first");

/**
 * Standalone bot sender for scheduled notifications. Kept separate from the
 * webhook's best-effort reply so a failed reminder can be retried explicitly.
 */
export async function sendTelegramMessage(
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
    throw new Error(`sendTelegramMessage returned ${response.status}`);
  }
}
