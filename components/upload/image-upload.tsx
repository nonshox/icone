"use client";

import { Loader2 } from "lucide-react";
import {
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type ReactNode,
} from "react";

import { T } from "@/components/i18n/t";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useUploadImage, type UploadFolder } from "@/lib/api/barber-queries";
import { imageUrl } from "@/lib/client/files";

type Props = {
  /** Stored Appwrite file id, or a legacy external URL. */
  value: string;
  /** Called with the stored file id — never with a preview URL. */
  onChange: (id: string) => void;
  folder: UploadFolder;
  id?: string;
  label?: ReactNode;
  hint?: boolean;
};

type Phase = "idle" | "uploading" | "done" | "error";

/**
 * Reusable image picker. It posts the raw File as multipart/form-data and
 * hands the resulting Appwrite file id back to the caller; the preview URL is
 * only kept locally for immediate feedback.
 */
export function ImageUpload({
  value,
  onChange,
  folder,
  id,
  label,
  hint = true,
}: Props) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const inputRef = useRef<HTMLInputElement>(null);
  const upload = useUploadImage();

  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState(0);
  const [preview, setPreview] = useState("");

  const busy = phase === "uploading";
  const src = imageUrl(value) || preview;

  async function onFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // Reset so picking the same file twice still fires a change event.
    event.target.value = "";
    if (!file) return;

    setPhase("uploading");
    setProgress(0);
    setPreview("");

    try {
      const result = await upload.mutateAsync({
        file,
        folder,
        onProgress: setProgress,
      });
      setPreview(result.url);
      onChange(result.id);
      setPhase("done");
    } catch {
      setPhase("error");
    }
  }

  return (
    <div className="space-y-2">
      {label ? <Label htmlFor={inputId}>{label}</Label> : null}
      <div className="flex items-center gap-3">
        <div className="size-16 shrink-0 overflow-hidden rounded-xl border border-border bg-muted">
          {src ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={src} alt="" className="size-full object-cover" />
          ) : null}
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <Input
            ref={inputRef}
            id={inputId}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif"
            disabled={busy}
            onChange={onFile}
          />
          <p className="text-xs text-muted-foreground">
            <T k={value ? "upload.change" : "upload.pick"} />
          </p>
          {hint ? (
            <p className="text-xs text-muted-foreground">
              <T k="upload.hint" />
            </p>
          ) : null}
          {phase === "uploading" ? (
            <p
              role="status"
              aria-live="polite"
              className="flex items-center gap-2 text-xs text-brand-strong"
            >
              <Loader2 className="size-3 animate-spin" aria-hidden />
              <T k="upload.uploading" />
              {progress > 0 ? (
                <span className="tabular-nums">{progress}%</span>
              ) : null}
            </p>
          ) : phase === "done" ? (
            <p role="status" className="text-xs text-brand-strong">
              <T k="upload.done" />
            </p>
          ) : phase === "error" ? (
            <p role="alert" className="text-xs text-destructive">
              <T k="upload.failed" />
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
