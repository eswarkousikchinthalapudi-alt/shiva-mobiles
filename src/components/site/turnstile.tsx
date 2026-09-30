"use client";

import Script from "next/script";
import { useCallback, useEffect, useRef } from "react";

type TurnstileApi = {
  render: (el: HTMLElement, options: Record<string, unknown>) => string;
  reset: (widgetId?: string) => void;
  remove: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

/**
 * Cloudflare Turnstile check (the "I am human" box). Renders nothing when no
 * site key is configured. The widget adds a hidden `cf-turnstile-response`
 * field to the surrounding form. Rendered explicitly so it also works when the
 * form is shown again after going back a step. Change `resetSignal` after a
 * failed submit: each token can only be used once.
 */
export function Turnstile({ siteKey, nonce, resetSignal }: { siteKey: string | null; nonce: string | null; resetSignal?: unknown }) {
  const box = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);

  const render = useCallback(() => {
    if (!siteKey || !box.current || !window.turnstile || widgetId.current) return;
    widgetId.current = window.turnstile.render(box.current, { sitekey: siteKey, theme: "auto", size: "flexible" });
  }, [siteKey]);

  useEffect(() => {
    render();
    return () => {
      if (widgetId.current) window.turnstile?.remove(widgetId.current);
      widgetId.current = null;
    };
  }, [render]);

  useEffect(() => {
    if (resetSignal && widgetId.current) window.turnstile?.reset(widgetId.current);
  }, [resetSignal]);

  if (!siteKey) return null;
  return (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
        nonce={nonce ?? undefined}
        onReady={render}
      />
      <div ref={box} className="min-h-[65px]" />
    </>
  );
}
