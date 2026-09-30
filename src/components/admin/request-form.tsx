"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { updateSellRequestAction } from "@/app/admin/(panel)/requests/actions";
import type { SellStatus } from "@/db/schema";
import { buttonClass } from "@/components/ui/button";
import { Alert, Field, Group, inputClass } from "./ui";
import { cn } from "@/components/ui/cn";

const STATUSES: { value: SellStatus; label: string }[] = [
  { value: "new", label: "New" },
  { value: "contacted", label: "Contacted" },
  { value: "offer_sent", label: "Offer sent" },
  { value: "pickup_scheduled", label: "Pickup booked" },
  { value: "bought", label: "Bought" },
  { value: "rejected", label: "Not buying" },
  { value: "cancelled", label: "Cancelled by seller" },
];

export function RequestUpdateForm({
  id,
  status,
  offerPrice,
  pickupAt,
  adminNotes,
}: {
  id: string;
  status: SellStatus;
  offerPrice: number | null;
  pickupAt: string | null;
  adminNotes: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [form, setForm] = useState({
    status,
    offerPrice: offerPrice ? String(offerPrice) : "",
    pickupAt: pickupAt ?? "",
    publicNote: "",
    adminNotes,
  });
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const res = await updateSellRequestAction({
            id,
            status: form.status,
            offerPrice: form.offerPrice ? Number(form.offerPrice.replace(/\D/g, "")) : null,
            pickupAt: form.pickupAt || null,
            publicNote: form.publicNote || null,
            adminNotes: form.adminNotes,
          });
          if (res.ok) {
            setResult({ ok: true, text: "Saved. The seller sees the new status on their tracking page." });
            setForm((f) => ({ ...f, publicNote: "" }));
            router.refresh();
          } else setResult({ ok: false, text: res.error });
        });
      }}
    >
      <Group label="Status">
        <div className="flex flex-wrap gap-2">
          {STATUSES.map((s) => (
            <button
              key={s.value}
              type="button"
              aria-pressed={form.status === s.value}
              onClick={() => setForm({ ...form, status: s.value })}
              className={cn(
                "h-10 rounded-full border px-3.5 text-sm font-semibold",
                form.status === s.value ? "border-brand bg-brand text-brand-fg" : "border-line-strong",
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
      </Group>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Your offer (₹)" htmlFor="offer">
          <input
            id="offer"
            className={inputClass}
            inputMode="numeric"
            value={form.offerPrice}
            onChange={(e) => setForm({ ...form, offerPrice: e.target.value })}
          />
        </Field>
        <Field label="Pickup date and time" htmlFor="pickup">
          <input
            id="pickup"
            type="datetime-local"
            className={inputClass}
            value={form.pickupAt}
            onChange={(e) => setForm({ ...form, pickupAt: e.target.value })}
          />
        </Field>
      </div>
      <Field
        label="Message for the seller (shown on their tracking page)"
        htmlFor="publicNote"
        hint="Optional. Keep it short, e.g. “We will come at 5 pm. Keep the box ready.”"
      >
        <input
          id="publicNote"
          className={inputClass}
          maxLength={300}
          value={form.publicNote}
          onChange={(e) => setForm({ ...form, publicNote: e.target.value })}
        />
      </Field>
      <Field label="Private notes (only staff see these)" htmlFor="adminNotes">
        <textarea
          id="adminNotes"
          className={cn(inputClass, "h-24 py-2")}
          maxLength={2000}
          value={form.adminNotes}
          onChange={(e) => setForm({ ...form, adminNotes: e.target.value })}
        />
      </Field>
      {result ? (
        <Alert live tone={result.ok ? "ok" : "bad"}>
          {result.text}
        </Alert>
      ) : null}
      <button type="submit" disabled={pending} className={buttonClass("primary", "lg", "w-full sm:w-auto")}>
        {pending ? "Saving…" : "Save"}
      </button>
    </form>
  );
}
