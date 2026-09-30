import "server-only";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import type { SaleItem } from "@/db/schema";
import { billTokenOf } from "@/lib/sales";
import { sha256Hex } from "@/lib/security/crypto";

export type Bill = {
  billNo: string;
  token: string;
  date: Date;
  buyerName: string;
  buyerPhone: string;
  soldPriceInr: number;
  paymentMode: string;
  warrantyMonths: number;
  warrantyUntil: string;
  item: SaleItem;
  voidedAt: Date | null;
};

/**
 * Looks up a bill by the private token in its link. Everything shown comes
 * from the copy saved at the time of sale. IMEI numbers are never stored,
 * so a forwarded link can't reveal one.
 */
export async function billByToken(token: string): Promise<Bill | null> {
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return null;
  const db = await getDb();
  const [sale] = await db
    .select()
    .from(schema.sales)
    .where(eq(schema.sales.tokenHash, await sha256Hex(token)))
    .limit(1);
  if (!sale) return null;
  return {
    billNo: sale.billNo,
    token,
    date: sale.createdAt,
    buyerName: sale.buyerName,
    buyerPhone: sale.buyerPhone,
    soldPriceInr: sale.soldPriceInr,
    paymentMode: sale.paymentMode,
    warrantyMonths: sale.warrantyMonths,
    warrantyUntil: sale.warrantyUntil,
    item: sale.item,
    voidedAt: sale.voidedAt,
  };
}

/** For the warranty check form: bill number + the buyer's mobile number. Returns the link token. */
export async function billTokenByNumber(billNo: string, mobile: string): Promise<string | null> {
  const db = await getDb();
  const [row] = await db
    .select({ tokenEnc: schema.sales.tokenEnc, phone: schema.sales.buyerPhone })
    .from(schema.sales)
    .where(eq(schema.sales.billNo, billNo))
    .limit(1);
  if (!row || row.phone !== mobile) return null;
  return billTokenOf(row);
}
