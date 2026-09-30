"use client";

import { useState, useTransition } from "react";
import { deleteSellRequestAction } from "@/app/admin/(panel)/requests/actions";
import { buttonClass } from "@/components/ui/button";

export function DeleteRequestButton({ id }: { id: string }) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  if (!confirming) {
    return (
      <button type="button" onClick={() => setConfirming(true)} className={buttonClass("ghost", "sm", "text-bad")}>
        Delete this request and photos
      </button>
    );
  }
  return (
    <div className="space-y-2 rounded-2xl bg-bad-soft p-3">
      <p className="text-[0.95rem] text-bad">This removes the seller’s details and photos for good. Use it when they ask to be removed.</p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const res = await deleteSellRequestAction(id);
              if (!res.ok) setError(res.error);
            })
          }
          className={buttonClass("danger", "sm")}
        >
          {pending ? "Deleting…" : "Yes, delete"}
        </button>
        <button type="button" onClick={() => setConfirming(false)} className={buttonClass("ghost", "sm")}>
          Cancel
        </button>
      </div>
      {error ? (
        <p role="alert" className="text-sm font-medium text-bad">
          {error}
        </p>
      ) : null}
    </div>
  );
}
