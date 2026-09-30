"use client";

import { Check, Copy, Download, Loader2, MessageCircle, Send, X } from "lucide-react";
import { useRef, useState } from "react";
import { buttonClass } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";

type Prepared = { files: File[]; urls: string[] };

async function toFile(url: string, name: string): Promise<File> {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error("Could not load the picture.");
  const blob = await response.blob();
  return new File([blob], name, { type: blob.type || "image/png" });
}

/**
 * Share a phone to WhatsApp (Status, groups, broadcast lists) with the
 * poster, photos and a ready caption. Uses the phone's own share menu, so it
 * works with the normal WhatsApp or WhatsApp Business app — no bots.
 */
export function WhatsAppShare({
  code,
  captionEn,
  captionTe,
  posterUrl,
  photoUrls,
  className,
  compact = false,
}: {
  code: string;
  captionEn: string;
  captionTe: string;
  posterUrl: string;
  photoUrls: string[];
  className?: string;
  compact?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [lang, setLang] = useState<"en" | "te">("en");
  const [includePhotos, setIncludePhotos] = useState(true);
  const [prepared, setPrepared] = useState<Prepared | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const caption = lang === "en" ? captionEn : captionTe;

  const prepare = async (withPhotos: boolean) => {
    setLoading(true);
    setError(null);
    try {
      const poster = await toFile(`${posterUrl}?v=${Date.now()}`, `${code}-poster.png`);
      const extra = withPhotos ? await Promise.all(photoUrls.slice(0, 3).map((u, i) => toFile(u, `${code}-${i + 1}.webp`))) : [];
      const files = [poster, ...extra];
      setPrepared({ files, urls: files.map((f) => URL.createObjectURL(f)) });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not prepare the pictures.");
    } finally {
      setLoading(false);
    }
  };

  const open = () => {
    ref.current?.showModal();
    if (!prepared) void prepare(includePhotos);
  };

  const copyCaption = async () => {
    try {
      await navigator.clipboard.writeText(caption);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
      return true;
    } catch {
      return false;
    }
  };

  const shareNow = async () => {
    if (!prepared) return;
    await copyCaption();
    const data: ShareData = { files: prepared.files, text: caption };
    try {
      if (navigator.canShare?.(data)) {
        await navigator.share(data);
        return;
      }
      if (navigator.canShare?.({ files: prepared.files })) {
        await navigator.share({ files: prepared.files });
        return;
      }
      setError("This browser can't share pictures directly. Download them below, then share from WhatsApp. The caption is copied.");
    } catch (e) {
      if ((e as DOMException)?.name !== "AbortError") setError("Sharing was cancelled or blocked. You can download the pictures below.");
    }
  };

  return (
    <>
      <button type="button" onClick={open} className={cn(buttonClass("chat", compact ? "sm" : "lg"), className)}>
        <Send className="h-4 w-4" aria-hidden />
        {compact ? "Share" : "Share to WhatsApp"}
      </button>
      <dialog ref={ref} className="sheet" aria-label="Share to WhatsApp" onClick={(e) => e.target === ref.current && ref.current?.close()}>
        <div className="flex max-h-[88dvh] flex-col">
          <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
            <h2 className="font-display text-lg font-semibold">Share to WhatsApp</h2>
            <button
              type="button"
              onClick={() => ref.current?.close()}
              className="grid h-10 w-10 place-items-center rounded-full hover:bg-surface-3"
              aria-label="Close"
            >
              <X className="h-5 w-5" aria-hidden />
            </button>
          </div>
          <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
            <div className="flex gap-3 overflow-x-auto">
              {loading ? (
                <div className="grid h-40 w-32 shrink-0 place-items-center rounded-xl bg-surface-2">
                  <Loader2 className="h-6 w-6 animate-spin text-muted" aria-label="Preparing" />
                </div>
              ) : (
                prepared?.urls.map((url, i) => (
                  <a key={url} href={url} download={prepared.files[i].name} className="relative block shrink-0" aria-label={`Download picture ${i + 1}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt="" className="h-40 w-32 rounded-xl object-cover" />
                    <span className="absolute bottom-1.5 right-1.5 grid h-7 w-7 place-items-center rounded-lg bg-surface/90">
                      <Download className="h-4 w-4" aria-hidden />
                    </span>
                  </a>
                ))
              )}
            </div>
            <label className="flex items-center gap-2.5 text-sm font-medium">
              <input
                type="checkbox"
                className="h-5 w-5 accent-[var(--brand)]"
                checked={includePhotos}
                onChange={(e) => {
                  setIncludePhotos(e.target.checked);
                  void prepare(e.target.checked);
                }}
              />
              Add the phone photos after the poster
            </label>
            <div>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-semibold">Caption</p>
                <div className="flex rounded-lg border border-line-strong p-0.5 text-sm">
                  {(["en", "te"] as const).map((l) => (
                    <button
                      key={l}
                      type="button"
                      onClick={() => setLang(l)}
                      aria-pressed={lang === l}
                      className={cn("rounded-md px-3 py-1 font-medium", lang === l ? "bg-brand text-brand-fg" : "")}
                    >
                      {l === "en" ? "English" : "తెలుగు"}
                    </button>
                  ))}
                </div>
              </div>
              <pre lang={lang} className="whitespace-pre-wrap rounded-xl bg-surface-2 p-3 font-sans text-sm leading-relaxed">
                {caption}
              </pre>
            </div>
            {error ? <p className="rounded-xl bg-warn-soft px-3 py-2 text-sm font-medium text-warn">{error}</p> : null}
            <p className="text-xs text-muted">
              Tip: after WhatsApp opens, pick “My status”, a group or a broadcast list. If the caption doesn&apos;t appear, press and hold the message box and
              tap Paste.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 border-t border-line px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <button type="button" onClick={copyCaption} className={buttonClass("secondary", "lg")}>
              {copied ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
              {copied ? "Copied" : "Copy caption"}
            </button>
            <button type="button" onClick={shareNow} disabled={!prepared || loading} className={buttonClass("chat", "lg")}>
              <MessageCircle className="h-4 w-4" aria-hidden />
              Share now
            </button>
            <a
              href={`https://wa.me/?text=${encodeURIComponent(caption)}`}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonClass("ghost", "md", "col-span-2")}
            >
              Send text only in WhatsApp
            </a>
          </div>
        </div>
      </dialog>
    </>
  );
}
