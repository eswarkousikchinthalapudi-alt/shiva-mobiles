"use client";

import { Check, MessageCircle, Phone, Share2 } from "lucide-react";
import { useState } from "react";
import { useT } from "@/i18n/client";
import { buttonClass } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";

function track(listingId: string, kind: "whatsapp" | "call") {
  try {
    const body = JSON.stringify({ listingId, kind });
    if (!navigator.sendBeacon?.("/api/track", new Blob([body], { type: "application/json" }))) {
      void fetch("/api/track", { method: "POST", body, headers: { "Content-Type": "application/json" }, keepalive: true });
    }
  } catch {
    // Tracking is best-effort only.
  }
}

export function ContactButtons({
  listingId,
  whatsappHref,
  telHref,
  size = "lg",
  className,
  compact = false,
}: {
  listingId: string;
  whatsappHref: string | null;
  telHref: string | null;
  size?: "md" | "lg";
  className?: string;
  compact?: boolean;
}) {
  const t = useT();
  return (
    <div className={cn("flex gap-2", className)}>
      {whatsappHref ? (
        <a
          href={whatsappHref}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => track(listingId, "whatsapp")}
          className={buttonClass("chat", size, "flex-1")}
        >
          <MessageCircle className="h-5 w-5" aria-hidden />
          {compact ? t.action.whatsapp : t.action.askOnWhatsapp}
        </a>
      ) : null}
      {telHref ? (
        <a href={telHref} onClick={() => track(listingId, "call")} className={buttonClass("secondary", size, compact ? "px-4" : "flex-1")}>
          <Phone className="h-4 w-4" aria-hidden />
          {t.action.call}
        </a>
      ) : null}
    </div>
  );
}

export function ShareButton({ url, title, text }: { url: string; title: string; text?: string }) {
  const t = useT();
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className={buttonClass("secondary", "md")}
      onClick={async () => {
        if (navigator.share) {
          try {
            await navigator.share({ url, title, text });
            return;
          } catch {
            // User closed the share sheet; fall through to copy.
          }
        }
        try {
          await navigator.clipboard.writeText(url);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 2500);
        } catch {
          window.prompt(title, url);
        }
      }}
    >
      {copied ? <Check className="h-4 w-4" aria-hidden /> : <Share2 className="h-4 w-4" aria-hidden />}
      <span aria-live="polite">{copied ? t.action.shareLinkCopied : t.action.share}</span>
    </button>
  );
}
