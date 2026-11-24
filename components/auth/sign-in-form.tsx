"use client";

import {
  ArrowLeft,
  ArrowRight,
  Loader2,
  Mail,
  ShieldCheck,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { toast } from "sonner";

import { TelegramLogin } from "@/components/auth/telegram-login";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

type Step = "email" | "code";

type ApiResponse = {
  ok: boolean;
  error?: { message?: string; code?: string };
};

const TELEGRAM_ERRORS: Record<string, string> = {
  telegram:
    "Telegram sign-in didn't complete. Try again, or use an email code.",
  telegram_unavailable:
    "Telegram sign-in is temporarily unavailable. Use an email code instead.",
};

async function postJson(url: string, body: unknown): Promise<ApiResponse> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = (await response.json().catch(() => null)) as ApiResponse | null;

  if (!response.ok) {
    return {
      ok: false,
      error: {
        message:
          data?.error?.message ?? "Something went wrong. Please try again.",
        code: data?.error?.code,
      },
    };
  }

  return data ?? { ok: true };
}

export function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const codeInputRef = useRef<HTMLInputElement>(null);

  const rawNext = searchParams.get("next");
  const nextPath =
    rawNext && rawNext.startsWith("/") && !rawNext.startsWith("//")
      ? rawNext
      : "/account";

  const errorParam = searchParams.get("error");
  const initialError = errorParam ? (TELEGRAM_ERRORS[errorParam] ?? null) : null;

  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(initialError);
  const [pending, setPending] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setInterval(() => {
      setCooldown((value) => Math.max(0, value - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [cooldown]);

  useEffect(() => {
    if (step === "code") {
      codeInputRef.current?.focus();
    }
  }, [step]);

  const sendCode = useCallback(async (address: string) => {
    const result = await postJson("/api/auth/email/start", {
      email: address,
    });

    if (!result.ok) {
      throw new Error(result.error?.message ?? "Could not send the code.");
    }
  }, []);

  async function handleEmailSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const address = email.trim().toLowerCase();
    if (!address) {
      setError("Enter your email address.");
      return;
    }

    setPending(true);
    try {
      await sendCode(address);
      setEmail(address);
      setStep("code");
      setCode("");
      setCooldown(60);
      toast.success("Code sent", {
        description: `Check ${address} for your 6-digit code.`,
      });
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Could not send the code.",
      );
    } finally {
      setPending(false);
    }
  }

  const verifyCode = useCallback(
    async (value: string) => {
      if (pending) return;
      setError(null);
      setPending(true);

      try {
        const result = await postJson("/api/auth/email/verify", {
          code: value,
        });

        if (!result.ok) {
          throw new Error(result.error?.message ?? "Could not verify the code.");
        }

        toast.success("You're in", {
          description: "Welcome to icone.",
        });
        router.replace(nextPath);
        router.refresh();
      } catch (verifyError) {
        setError(
          verifyError instanceof Error
            ? verifyError.message
            : "Could not verify the code.",
        );
        setCode("");
        codeInputRef.current?.focus();
      } finally {
        setPending(false);
      }
    },
    [nextPath, pending, router],
  );

  async function handleCodeSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!/^\d{6}$/.test(code)) {
      setError("Enter the 6-digit code from your email.");
      return;
    }
    await verifyCode(code);
  }

  async function handleResend() {
    if (cooldown > 0 || pending) return;
    setError(null);
    setPending(true);
    try {
      await sendCode(email);
      setCooldown(60);
      setCode("");
      toast.success("New code sent", {
        description: `Check ${email} again.`,
      });
    } catch (resendError) {
      setError(
        resendError instanceof Error
          ? resendError.message
          : "Could not resend the code.",
      );
    } finally {
      setPending(false);
    }
  }

  function changeEmail() {
    setStep("email");
    setCode("");
    setError(null);
    setCooldown(0);
  }

  return (
    <div>
      {step === "email" ? (
        <form
          onSubmit={handleEmailSubmit}
          className="animate-in fade-in-0 slide-in-from-bottom-1 space-y-4 duration-200"
        >
          <div className="space-y-2">
            <Label htmlFor="email">Email address</Label>
            <div className="relative">
              <Mail
                className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                id="email"
                name="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="you@example.com"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                disabled={pending}
                aria-invalid={Boolean(error)}
                className="h-11 rounded-xl bg-background/40 pr-3 pl-10 text-base sm:text-sm"
              />
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">
              First time here? We&apos;ll create your account automatically.
            </p>
          </div>

          <Button
            type="submit"
            size="lg"
            disabled={pending}
            className="h-11 w-full gap-2 rounded-xl text-sm"
          >
            {pending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : null}
            {pending ? "Sending code" : "Send me a code"}
            {!pending ? <ArrowRight className="size-4" aria-hidden /> : null}
          </Button>
        </form>
      ) : (
        <form
          onSubmit={handleCodeSubmit}
          className="animate-in fade-in-0 slide-in-from-bottom-1 space-y-4 duration-200"
        >
          <button
            type="button"
            onClick={changeEmail}
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" aria-hidden />
            Use a different email
          </button>

          <div className="space-y-2">
            <Label htmlFor="code">Your 6-digit code</Label>
            <Input
              ref={codeInputRef}
              id="code"
              name="code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]*"
              maxLength={6}
              placeholder="••••••"
              value={code}
              onChange={(event) => {
                const next = event.target.value.replace(/\D/g, "").slice(0, 6);
                setCode(next);
                if (next.length === 6) void verifyCode(next);
              }}
              disabled={pending}
              aria-invalid={Boolean(error)}
              className="h-14 rounded-xl bg-background/40 text-center text-2xl font-medium tracking-[0.4em] tabular-nums"
            />
            <p className="text-xs leading-relaxed text-muted-foreground">
              Sent to <span className="text-foreground">{email}</span>. The code
              expires in 10 minutes.
            </p>
          </div>

          <Button
            type="submit"
            size="lg"
            disabled={pending || code.length !== 6}
            className="h-11 w-full gap-2 rounded-xl text-sm"
          >
            {pending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <ShieldCheck className="size-4" aria-hidden />
            )}
            {pending ? "Verifying" : "Verify and continue"}
          </Button>

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Didn&apos;t get it?</span>
            <button
              type="button"
              onClick={handleResend}
              disabled={cooldown > 0 || pending}
              className="font-medium text-foreground underline-offset-4 transition-colors hover:text-brand-strong hover:underline disabled:cursor-not-allowed disabled:opacity-50"
            >
              {cooldown > 0
                ? `Resend in 0:${String(cooldown).padStart(2, "0")}`
                : "Resend code"}
            </button>
          </div>
        </form>
      )}

      {error ? (
        <div
          role="alert"
          aria-live="polite"
          className="mt-4 rounded-xl border border-destructive/25 bg-destructive/10 px-3.5 py-2.5 text-sm leading-relaxed text-destructive"
        >
          {error}
        </div>
      ) : null}

      <div className="my-6 flex items-center gap-3 text-[0.65rem] font-medium tracking-[0.14em] text-muted-foreground uppercase">
        <Separator className="flex-1" />
        or
        <Separator className="flex-1" />
      </div>

      <TelegramLogin />
    </div>
  );
}
