"use client";

import { Check, MessageCircle } from "lucide-react";
import { useState, useTransition } from "react";
import { markWantedNotifiedAction } from "@/app/admin/(panel)/phones/actions";
import { formatInr, whatsappLink } from "@/lib/format";
import { wantedPhoneMessage } from "@/lib/messages";
import { buttonClass } from "@/components/ui/button";

type Match = { id: string; name: string; phone: string; wantText: string; maxBudget: number | null; lang: "en" | "te" };

export function WantedMatchList({
  matches,
  phoneName,
  priceInr,
  url,
  shopName,
}: {
  matches: Match[];
  phoneName: string;
  priceInr: number;
  url: string;
  shopName: string;
}) {
  const [done, setDone] = useState<Set<string>>(new Set());
  const [pending, start] = useTransition();
  return (
    <ul className="divide-y divide-line">
      {matches.map((m) => {
        const message = wantedPhoneMessage(m.lang, { name: m.name, shopName, wantText: m.wantText, phoneName, priceInr, url });
        const told = done.has(m.id);
        return (
          <li key={m.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
            <div className="min-w-0">
              <p className="font-semibold">{m.name}</p>
              <p className="text-sm text-muted">
                “{m.wantText}”{m.maxBudget ? ` · budget ${formatInr(m.maxBudget)}` : ""}
              </p>
            </div>
            <div className="flex gap-2">
              <a href={whatsappLink(`91${m.phone}`, message)} target="_blank" rel="noopener noreferrer" className={buttonClass("chat", "sm")}>
                <MessageCircle className="h-4 w-4" aria-hidden /> Message
              </a>
              <button
                type="button"
                disabled={told || pending}
                onClick={() =>
                  start(async () => {
                    const result = await markWantedNotifiedAction(m.id);
                    if (result.ok) setDone(new Set([...done, m.id]));
                  })
                }
                className={buttonClass("secondary", "sm")}
              >
                {told ? <Check className="h-4 w-4" aria-hidden /> : null}
                {told ? "Told" : "Mark told"}
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
