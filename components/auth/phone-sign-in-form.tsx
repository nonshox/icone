"use client";

import { ExternalLink, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { T } from "@/components/i18n/t";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useT } from "@/lib/i18n/use-t";

/** Phone is shared with one tap in Telegram. The code is typed where you are. */
export function PhoneSignInForm() {
  const [step, setStep] = useState<"phone" | "manual" | "code">("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [botLink, setBotLink] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const t = useT();

  async function request(body: { phone?: string }) {
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/auth/phone/start", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await response.json().catch(() => null)) as {
        botLink?: string;
        error?: { message?: string };
      } | null;
      if (!response.ok) throw new Error(data?.error?.message ?? t("auth.tryAgain"));
      setBotLink(data?.botLink ?? "");
      setStep("code");
      toast.success(t("auth.codeSent"));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("auth.tryAgain"));
    } finally {
      setPending(false);
    }
  }

  async function verifyCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/auth/phone/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = (await response.json().catch(() => null)) as {
        error?: { message?: string };
      } | null;
      if (!response.ok) throw new Error(data?.error?.message ?? t("auth.tryAgain"));
      router.push("/start");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("auth.tryAgain"));
    } finally {
      setPending(false);
    }
  }

  if (step === "code") {
    return (
      <form className="space-y-4" onSubmit={verifyCode}>
        <div className="space-y-1.5">
          <Label htmlFor="otp-code"><T k="auth.code" /></Label>
          <Input
            id="otp-code"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={4}
            required
            value={code}
            onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
            className="h-12 text-center text-2xl tracking-[0.4em]"
          />
        </div>
        {botLink ? (
          <a
            href={botLink}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-border text-sm text-muted-foreground hover:text-foreground"
          >
            <ExternalLink className="size-4" aria-hidden />
            <T k="auth.openBot" />
          </a>
        ) : null}
        {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
        <Button type="submit" size="lg" className="h-11 w-full" disabled={pending}>
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
          <T k="auth.verify" />
        </Button>
        <button
          type="button"
          className="w-full text-xs text-muted-foreground hover:text-foreground"
          onClick={() => { setStep("phone"); setCode(""); setError(""); }}
        >
          <T k="auth.useAnotherPhone" />
        </button>
      </form>
    );
  }

  if (step === "manual") {
    return (
      <form
        className="space-y-4"
        onSubmit={(event) => { event.preventDefault(); void request({ phone }); }}
      >
        <div className="space-y-1.5">
          <Label htmlFor="otp-phone"><T k="auth.phone" /></Label>
          <Input
            id="otp-phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            required
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            className="h-12"
          />
        </div>
        {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
        <Button type="submit" size="lg" className="h-11 w-full" disabled={pending}>
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
          <T k="auth.sendCode" />
        </Button>
      </form>
    );
  }

  return (
    <div className="space-y-3">
      <Button
        type="button"
        size="lg"
        className="h-11 w-full"
        disabled={pending}
        onClick={() => void request({})}
      >
        {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
        <T k="auth.sharePhone" />
      </Button>
      <p className="text-center text-xs text-muted-foreground"><T k="auth.shareHelp" /></p>
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
      <button
        type="button"
        className="w-full text-xs text-muted-foreground hover:text-foreground"
        onClick={() => setStep("manual")}
      >
        <T k="auth.manualPhone" />
      </button>
    </div>
  );
}
