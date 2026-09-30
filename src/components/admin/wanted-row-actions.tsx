"use client";

import { MessageCircle } from "lucide-react";
import { useState, useTransition } from "react";
import { deleteWantedAction, setWantedStatusAction } from "@/app/admin/(panel)/wanted/actions";
import type { WantedStatus } from "@/db/schema";
import { whatsappLink } from "@/lib/format";
import { buttonClass } from "@/components/ui/button";

type Props = {
  id: string;
  status: WantedStatus;
  phone: string;
  /** Pre-written WhatsApp text (a matching phone, or a hello). */
  message: string;
  messageLabel: string;
};

export function WantedRowActions({ id, status, phone, message, messageLabel }: Props) {
  const [pending, start] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = (fn: () => Promise<{ ok: true } | { ok: false; error: string }>) =>
    start(async () => {
      setError(null);
      const res = await fn();
      if (!res.ok) setError(res.error);
    });

  return (
    <div className="flex flex-wrap items-center gap-2">
      <a href={whatsappLink(`91${phone}`, message)} target="_blank" rel="noopener noreferrer" className={buttonClass("chat", "sm")}>
        <MessageCircle className="h-4 w-4" aria-hidden /> {messageLabel}
      </a>
      {status === "open" ? (
        <button type="button" disabled={pending} onClick={() => run(() => setWantedStatusAction(id, "notified"))} className={buttonClass("secondary", "sm")}>
          Mark told
        </button>
      ) : (
        <button type="button" disabled={pending} onClick={() => run(() => setWantedStatusAction(id, "open"))} className={buttonClass("secondary", "sm")}>
          Back to waiting
        </button>
      )}
      {status !== "closed" ? (
        <button type="button" disabled={pending} onClick={() => run(() => setWantedStatusAction(id, "closed"))} className={buttonClass("ghost", "sm")}>
          Close
        </button>
      ) : null}
      {confirmDelete ? (
        <span className="inline-flex items-center gap-2">
          <button type="button" disabled={pending} onClick={() => run(() => deleteWantedAction(id))} className={buttonClass("danger", "sm")}>
            Yes, delete
          </button>
          <button type="button" onClick={() => setConfirmDelete(false)} className={buttonClass("ghost", "sm")}>
            Cancel
          </button>
        </span>
      ) : (
        <button type="button" onClick={() => setConfirmDelete(true)} className={buttonClass("ghost", "sm", "text-bad")}>
          Delete
        </button>
      )}
      {error ? (
        <p role="alert" className="w-full text-sm font-medium text-bad">
          {error}
        </p>
      ) : null}
    </div>
  );
}
