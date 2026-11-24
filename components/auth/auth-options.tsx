"use client";

import { PhoneSignInForm } from "@/components/auth/phone-sign-in-form";

/** Telegram only: a phone number in, a 4-digit code from the bot. */
export function AuthOptions() {
  return <PhoneSignInForm />;
}
