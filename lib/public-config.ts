/**
 * Public configuration that is safe to ship to the browser.
 * Must never contain API keys, bot tokens or other secrets.
 */
export const publicConfig = {
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  appwriteEndpoint:
    process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT ??
    "https://fra.cloud.appwrite.io/v1",
  appwriteProjectId: process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID ?? "icone",
  telegramBotUsername:
    process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME ?? "icone_app_bot",
  /**
   * The Login Widget only works on a domain registered with the bot
   * (`@BotFather` → `/setdomain`). Set to "false" on hosts that aren't
   * registered — including localhost — so the UI shows a clean fallback
   * instead of Telegram's "Bot domain invalid" frame.
   */
  telegramLoginEnabled:
    (process.env.NEXT_PUBLIC_TELEGRAM_LOGIN_ENABLED ?? "true") === "true",
} as const;
