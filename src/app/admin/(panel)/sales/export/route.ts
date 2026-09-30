import { getAdminOrNull } from "@/lib/auth/dal";
import { audit } from "@/lib/audit";
import { salesForMonth } from "@/lib/admin/sales";
import { isMonthString, istDateString } from "@/lib/dates";

/** Stops spreadsheet apps from running a cell as a formula (=, +, -, @). */
function cell(value: string | number | null | undefined): string {
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "";
  let text = value ?? "";
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

export async function GET(request: Request) {
  const admin = await getAdminOrNull({ role: "owner" });
  if (!admin) return new Response("Not allowed", { status: 403 });
  const month = new URL(request.url).searchParams.get("month");
  if (!isMonthString(month)) return new Response("Bad month", { status: 400 });
  const rows = await salesForMonth(month);
  const header = [
    "Date",
    "Bill no",
    "Status",
    "Phone ID",
    "Phone",
    "Storage GB",
    "Buyer",
    "Mobile",
    "Paid by",
    "Price",
    "Buying cost",
    "Margin",
    "Warranty months",
    "Warranty until",
  ];
  const lines = [header.map(cell).join(",")];
  for (const r of [...rows].reverse()) {
    lines.push(
      [
        istDateString(r.createdAt),
        r.billNo,
        r.cancelled ? "cancelled" : "sold",
        r.code,
        r.phoneName,
        r.storageGb,
        r.buyerName,
        r.buyerPhone,
        r.paymentMode,
        r.soldPriceInr,
        r.costInr,
        r.costInr === null ? null : r.soldPriceInr - r.costInr,
        r.warrantyMonths,
        r.warrantyUntil,
      ]
        .map(cell)
        .join(","),
    );
  }
  await audit(admin, "sales_exported", { details: { month, rows: rows.length } });
  // BOM so Excel opens the ₹ and Telugu names correctly.
  return new Response(`﻿${lines.join("\r\n")}\r\n`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="sales-${month}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
