/** A narrow, serialisable view of the authenticated user. */
export type AuthProvider = "email" | "telegram" | "unknown";

export type SessionUser = {
  id: string;
  name: string;
  email: string | null;
  /** ISO 8601 registration date. */
  createdAt: string;
  provider: AuthProvider;
  telegramUsername: string | null;
  avatarUrl: string | null;
};
