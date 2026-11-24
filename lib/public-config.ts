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
} as const;
