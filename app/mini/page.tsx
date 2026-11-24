import type { Metadata } from "next";

import { Logo } from "@/components/brand/logo";
import { MiniAppView } from "@/components/telegram/mini-app-view";

export const metadata: Metadata = {
  title: "Telegram",
  robots: { index: false, follow: false },
};

export default function MiniPage() {
  return (
    <main
      id="main"
      className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center px-4 py-8"
    >
      <div className="mb-6 flex justify-center">
        <Logo />
      </div>
      <MiniAppView />
    </main>
  );
}
