"use client";

import Image from "next/image";

import { useT } from "@/lib/i18n/use-t";

export default function GlobalError({
  error: _error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  void _error;
  const t = useT();

  return (
    <html lang="uz">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          fontFamily: "system-ui, sans-serif",
          background: "#f7f5f0",
          color: "#181714",
        }}
      >
        <div style={{ textAlign: "center", padding: 24 }}>
          <Image
            src="/logotype/android-chrome-192x192.png"
            alt="icone"
            width={96}
            height={96}
            style={{ margin: "0 auto 12px", borderRadius: 10 }}
          />
          <h1 style={{ fontSize: 20, margin: "0 0 8px" }}>
            {t("error.title")}
          </h1>
          <p style={{ fontSize: 14, opacity: 0.7, margin: "0 0 20px" }}>
            {t("error.body")}
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              padding: "10px 18px",
              borderRadius: 8,
              border: 0,
              background: "#181714",
              color: "white",
              cursor: "pointer",
            }}
          >
            {t("common.tryAgain")}
          </button>
        </div>
      </body>
    </html>
  );
}
