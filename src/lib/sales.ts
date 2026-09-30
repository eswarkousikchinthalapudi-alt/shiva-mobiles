import "server-only";
import type { SaleItem } from "@/db/schema";
import { fullModelName } from "@/lib/listings";
import { decryptString, encryptString, randomToken, sha256Hex } from "@/lib/security/crypto";

/** A fresh private link token for a bill: stored hashed (to find it) and encrypted (to send it again). */
export async function newBillToken() {
  const token = randomToken(24);
  return { token, tokenHash: await sha256Hex(token), tokenEnc: await encryptString(token, "bill-token") };
}

export async function billTokenOf(sale: { tokenEnc: string }): Promise<string | null> {
  return decryptString(sale.tokenEnc, "bill-token").catch(() => null);
}

export async function billPathOf(sale: { tokenEnc: string }): Promise<string | null> {
  const token = await billTokenOf(sale);
  return token ? `/bill/${token}` : null;
}

/** Copies what the customer bought, so later edits to the phone never change the bill. */
export function saleItemFrom(
  listing: {
    code: string;
    ramGb: number | null;
    storageGb: number;
    color: string;
    grade: SaleItem["grade"];
    batteryHealth: number | null;
    hasBox: boolean;
    hasCharger: boolean;
    hasBill: boolean;
    brandWarrantyUntil: string | null;
    imeiLast4: string | null;
  },
  brand: string,
  modelName: string,
): SaleItem {
  return {
    name: fullModelName(brand, modelName),
    code: listing.code,
    ramGb: listing.ramGb,
    storageGb: listing.storageGb,
    color: listing.color,
    grade: listing.grade,
    batteryHealth: listing.batteryHealth,
    hasBox: listing.hasBox,
    hasCharger: listing.hasCharger,
    hasBill: listing.hasBill,
    brandWarrantyUntil: listing.brandWarrantyUntil,
    imeiLast4: listing.imeiLast4,
  };
}
