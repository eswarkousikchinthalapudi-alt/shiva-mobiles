"use server";

import { redirect } from "next/navigation";
import { pad } from "@/db/helpers";
import { billTokenByNumber } from "@/lib/bills";
import { normalizeIndianMobile } from "@/lib/format";
import { rateLimit } from "@/lib/security/rate-limit";
import { getRequestInfo } from "@/lib/security/request";
import { verifyTurnstile } from "@/lib/security/turnstile";

/** The typed values come back so the form can show them again after an error. */
export type WarrantyState = { error: "notFound" | "rate" | "mobile" | "billNo" | "captcha"; billNo: string; mobile: string } | undefined;

/** Accepts "SB-2026-0001", "sb 2026 1" or "SB20260001". */
function normalizeBillNo(input: string): string | null {
  const match = /^SB[\s-]*(\d{4})[\s-]*(\d{1,6})$/i.exec(input.trim());
  if (!match) return null;
  return `SB-${match[1]}-${pad(Number(match[2]))}`;
}

export async function findBillAction(_prev: WarrantyState, formData: FormData): Promise<WarrantyState> {
  const typed = { billNo: String(formData.get("billNo") ?? "").slice(0, 30), mobile: String(formData.get("mobile") ?? "").slice(0, 20) };
  const billNo = normalizeBillNo(typed.billNo);
  if (!billNo) return { error: "billNo", ...typed };
  const mobile = normalizeIndianMobile(typed.mobile);
  if (!mobile) return { error: "mobile", ...typed };
  const { ip } = await getRequestInfo();
  const limit = await rateLimit(`warranty:${ip}`, 10, 600);
  if (!limit.allowed) return { error: "rate", ...typed };
  if (!(await verifyTurnstile(String(formData.get("cf-turnstile-response") ?? ""), ip))) return { error: "captcha", ...typed };
  // Limits that don't depend on the IP address, so bill numbers can't be tried one by one for someone's mobile.
  const perMobile = await rateLimit(`warranty-mobile:${mobile}`, 8, 24 * 3600);
  const perBill = await rateLimit(`warranty-bill:${billNo}`, 8, 24 * 3600);
  if (!perMobile.allowed || !perBill.allowed) return { error: "rate", ...typed };
  const token = await billTokenByNumber(billNo, mobile);
  if (!token) return { error: "notFound", ...typed };
  redirect(`/bill/${token}`);
}
