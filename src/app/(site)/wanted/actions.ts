"use server";

import { and, count, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "@/db";
import { isLang } from "@/i18n/dictionaries";
import { normalizeIndianMobile } from "@/lib/format";
import { rateLimit } from "@/lib/security/rate-limit";
import { getRequestInfo } from "@/lib/security/request";
import { verifyTurnstile } from "@/lib/security/turnstile";

export type WantedState = { ok: true } | { ok: false; error: "invalid" | "mobile" | "consent" | "captcha" | "rate" | "server"; field?: string } | undefined;

const wantedSchema = z.object({
  name: z.string().trim().min(2).max(60),
  want: z.string().trim().min(2).max(100),
  maxBudget: z.number().int().min(1000).max(500000).nullable(),
  lang: z.string(),
});

/** Most people keep a few requests at most; more usually means spam. */
const MAX_OPEN_PER_NUMBER = 3;

export async function submitWantedRequest(_prev: WantedState, formData: FormData): Promise<WantedState> {
  if (String(formData.get("website") ?? "").length > 0) return { ok: true };

  const { ip } = await getRequestInfo();
  const ipLimit = await rateLimit(`wanted-submit:${ip}`, 5, 3600);
  if (!ipLimit.allowed) return { ok: false, error: "rate" };
  if (!(await verifyTurnstile(String(formData.get("cf-turnstile-response") ?? ""), ip))) return { ok: false, error: "captcha" };
  if (formData.get("consent") !== "on") return { ok: false, error: "consent" };

  const budgetDigits = String(formData.get("maxBudget") ?? "").replace(/\D/g, "");
  const parsed = wantedSchema.safeParse({
    name: String(formData.get("name") ?? ""),
    want: String(formData.get("want") ?? ""),
    maxBudget: budgetDigits ? Number(budgetDigits) : null,
    lang: String(formData.get("lang") ?? "en"),
  });
  if (!parsed.success) return { ok: false, error: "invalid", field: String(parsed.error.issues[0]?.path[0] ?? "") };
  const mobile = normalizeIndianMobile(String(formData.get("phone") ?? "").slice(0, 20));
  if (!mobile) return { ok: false, error: "mobile", field: "phone" };
  const phoneLimit = await rateLimit(`wanted-phone:${mobile}`, 5, 24 * 3600);
  if (!phoneLimit.allowed) return { ok: false, error: "rate" };

  try {
    const db = await getDb();
    const [open] = await db
      .select({ n: count() })
      .from(schema.wantedRequests)
      .where(and(eq(schema.wantedRequests.phone, mobile), eq(schema.wantedRequests.status, "open")));
    if (Number(open?.n ?? 0) >= MAX_OPEN_PER_NUMBER) return { ok: false, error: "rate" };
    await db.insert(schema.wantedRequests).values({
      name: parsed.data.name,
      phone: mobile,
      wantText: parsed.data.want,
      maxBudget: parsed.data.maxBudget,
      lang: isLang(parsed.data.lang) ? parsed.data.lang : "en",
      consentAt: new Date(),
    });
  } catch (error) {
    console.error("[wanted] save failed", error);
    return { ok: false, error: "server" };
  }
  return { ok: true };
}
