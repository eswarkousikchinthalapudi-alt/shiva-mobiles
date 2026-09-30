"use client";

import { BadgeIndianRupee, Clock, Eye, EyeOff, MessageCircle, RotateCcw, Star, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import {
  deleteListingAction,
  markReviewRequestedAction,
  markSoldAction,
  setListingStatusAction,
  undoSaleAction,
  type SaleResult,
} from "@/app/admin/(panel)/phones/actions";
import { formatInr, whatsappLink } from "@/lib/format";
import { buttonClass } from "@/components/ui/button";
import { Alert, Field, inputClass } from "./ui";

export function ListingStatusActions({
  id,
  status,
  isOwner,
  priceInr,
  warrantyMonths,
}: {
  id: string;
  status: string;
  isOwner: boolean;
  priceInr: number;
  warrantyMonths: number;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const sheet = useRef<HTMLDialogElement>(null);
  const [sale, setSale] = useState<SaleResult | null>(null);
  const [form, setForm] = useState({
    buyerName: "",
    buyerPhone: "",
    soldPriceInr: String(priceInr),
    paymentMode: "upi",
    warrantyMonths: String(warrantyMonths),
  });

  const run = (fn: () => Promise<{ ok: boolean; error?: string } | undefined>) =>
    start(async () => {
      setError(null);
      const result = await fn();
      if (result && !result.ok) setError(result.error ?? "Something went wrong.");
      else router.refresh();
    });

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {status === "available" ? (
          <button type="button" disabled={pending} onClick={() => run(() => setListingStatusAction(id, "reserved"))} className={buttonClass("secondary", "md")}>
            <Clock className="h-4 w-4" aria-hidden /> Mark reserved
          </button>
        ) : null}
        {status === "reserved" || status === "hidden" || status === "draft" ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => setListingStatusAction(id, "available"))}
            className={buttonClass("secondary", "md")}
          >
            <Eye className="h-4 w-4" aria-hidden /> {status === "draft" ? "Publish" : "Make available"}
          </button>
        ) : null}
        {status === "available" || status === "reserved" ? (
          <button type="button" disabled={pending} onClick={() => run(() => setListingStatusAction(id, "hidden"))} className={buttonClass("ghost", "md")}>
            <EyeOff className="h-4 w-4" aria-hidden /> Hide
          </button>
        ) : null}
        {status === "available" || status === "reserved" ? (
          <button type="button" disabled={pending} onClick={() => sheet.current?.showModal()} className={buttonClass("primary", "md")}>
            <BadgeIndianRupee className="h-4 w-4" aria-hidden /> Mark sold
          </button>
        ) : null}
        {status === "sold" && isOwner ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              if (window.confirm("Cancel this sale? The bill will be marked cancelled and the phone will be for sale again.")) run(() => undoSaleAction(id));
            }}
            className={buttonClass("ghost", "md")}
          >
            <RotateCcw className="h-4 w-4" aria-hidden /> Cancel sale
          </button>
        ) : null}
        {isOwner && status !== "sold" ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              if (window.confirm("Delete this phone and its photos? This can't be undone.")) run(() => deleteListingAction(id));
            }}
            className={buttonClass("ghost", "md", "text-bad")}
          >
            <Trash2 className="h-4 w-4" aria-hidden /> Delete
          </button>
        ) : null}
      </div>
      {error ? (
        <Alert live tone="bad" className="mt-3">
          {error}
        </Alert>
      ) : null}

      <dialog ref={sheet} className="sheet" aria-label="Mark sold" onClick={(e) => e.target === sheet.current && !sale && sheet.current?.close()}>
        <div className="flex max-h-[88dvh] flex-col">
          <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
            <h2 className="font-display text-lg font-semibold">{sale ? "Sold!" : "Mark as sold"}</h2>
            <button
              type="button"
              onClick={() => {
                sheet.current?.close();
                if (sale) router.refresh();
              }}
              className="grid h-10 w-10 place-items-center rounded-full hover:bg-surface-3"
              aria-label="Close"
            >
              <X className="h-5 w-5" aria-hidden />
            </button>
          </div>
          <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
            {sale ? (
              <>
                <Alert live tone="ok">
                  Bill {sale.billNo} is ready. Send it to the customer so they have their warranty card.
                </Alert>
                <a
                  href={whatsappLink(`91${sale.buyerPhone}`, sale.message)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={buttonClass("chat", "lg", "w-full")}
                >
                  <MessageCircle className="h-4 w-4" aria-hidden /> Send bill on WhatsApp
                </a>
                {sale.reviewMessage ? (
                  <a
                    href={whatsappLink(`91${sale.buyerPhone}`, sale.reviewMessage)}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => void markReviewRequestedAction(sale.saleId)}
                    className={buttonClass("secondary", "lg", "w-full")}
                  >
                    <Star className="h-4 w-4" aria-hidden /> Ask for a Google review
                  </a>
                ) : (
                  <p className="text-sm text-muted">Add your Google review link in Shop settings to send review requests.</p>
                )}
                <a href={sale.billUrl} target="_blank" rel="noopener noreferrer" className={buttonClass("ghost", "md", "w-full")}>
                  Open the bill
                </a>
              </>
            ) : (
              <form
                id="sold-form"
                className="space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  start(async () => {
                    setError(null);
                    const result = await markSoldAction({
                      listingId: id,
                      buyerName: form.buyerName,
                      buyerPhone: form.buyerPhone,
                      soldPriceInr: Number(form.soldPriceInr.replace(/\D/g, "")) || 0,
                      paymentMode: form.paymentMode as "cash" | "upi" | "card" | "other",
                      warrantyMonths: Number(form.warrantyMonths) || 0,
                    });
                    if (result.ok && result.data) setSale(result.data);
                    else if (!result.ok) setError(result.error);
                  });
                }}
              >
                <Field label="Customer name" htmlFor="buyerName">
                  <input
                    id="buyerName"
                    className={inputClass}
                    required
                    maxLength={60}
                    value={form.buyerName}
                    onChange={(e) => setForm({ ...form, buyerName: e.target.value })}
                  />
                </Field>
                <Field label="Customer mobile" htmlFor="buyerPhone" hint="Used to send the bill and to check warranty later.">
                  <input
                    id="buyerPhone"
                    className={inputClass}
                    required
                    inputMode="tel"
                    maxLength={16}
                    value={form.buyerPhone}
                    onChange={(e) => setForm({ ...form, buyerPhone: e.target.value })}
                  />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Sold for (₹)" htmlFor="soldPrice" hint={`Listed at ${formatInr(priceInr)}`}>
                    <input
                      id="soldPrice"
                      className={inputClass}
                      required
                      inputMode="numeric"
                      value={form.soldPriceInr}
                      onChange={(e) => setForm({ ...form, soldPriceInr: e.target.value })}
                    />
                  </Field>
                  <Field label="Paid by" htmlFor="payment">
                    <select id="payment" className={inputClass} value={form.paymentMode} onChange={(e) => setForm({ ...form, paymentMode: e.target.value })}>
                      <option value="upi">UPI</option>
                      <option value="cash">Cash</option>
                      <option value="card">Card</option>
                      <option value="other">Other</option>
                    </select>
                  </Field>
                </div>
                <Field label="Shop warranty" htmlFor="warranty">
                  <select
                    id="warranty"
                    className={inputClass}
                    value={form.warrantyMonths}
                    onChange={(e) => setForm({ ...form, warrantyMonths: e.target.value })}
                  >
                    {[0, 1, 3, 6, 12].map((m) => (
                      <option key={m} value={m}>
                        {m === 0 ? "No warranty" : `${m} month${m === 1 ? "" : "s"}`}
                      </option>
                    ))}
                  </select>
                </Field>
                {error ? (
                  <Alert live tone="bad">
                    {error}
                  </Alert>
                ) : null}
              </form>
            )}
          </div>
          {!sale ? (
            <div className="border-t border-line px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              <button type="submit" form="sold-form" disabled={pending} className={buttonClass("primary", "lg", "w-full")}>
                {pending ? "Saving…" : "Save sale and make bill"}
              </button>
            </div>
          ) : null}
        </div>
      </dialog>
    </div>
  );
}

/** For phones already sold: resend the bill or ask for a review. */
export function SaleFollowUp({
  saleId,
  buyerPhone,
  billMessage,
  reviewMessage,
  reviewRequestedAt,
}: {
  saleId: string;
  buyerPhone: string;
  billMessage: string;
  reviewMessage: string | null;
  reviewRequestedAt: string | null;
}) {
  const [asked, setAsked] = useState(Boolean(reviewRequestedAt));
  return (
    <div className="flex flex-wrap gap-2">
      <a href={whatsappLink(`91${buyerPhone}`, billMessage)} target="_blank" rel="noopener noreferrer" className={buttonClass("chat", "md")}>
        <MessageCircle className="h-4 w-4" aria-hidden /> Send bill again
      </a>
      {reviewMessage ? (
        <a
          href={whatsappLink(`91${buyerPhone}`, reviewMessage)}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => {
            setAsked(true);
            void markReviewRequestedAction(saleId);
          }}
          className={buttonClass("secondary", "md")}
        >
          <Star className="h-4 w-4" aria-hidden /> {asked ? "Review asked (ask again)" : "Ask for a Google review"}
        </a>
      ) : null}
    </div>
  );
}
