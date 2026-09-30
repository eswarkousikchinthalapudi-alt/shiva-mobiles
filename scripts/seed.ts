/**
 * Fills the local database with demo data: shop details, a sample catalog,
 * demo phones with placeholder photos, a few requests and an owner account.
 *
 *   npm run db:seed            (local embedded database only)
 *   SEED_ADMIN_PASSWORD=... npm run db:seed
 *
 * It refuses to run against a real DATABASE_URL unless you pass --force,
 * so production data is never touched by accident.
 */
import sharp from "sharp";
import { eq, sql } from "drizzle-orm";
import { closeDb, getDb, schema } from "@/db/client";
import { nextCounter, pad } from "@/db/helpers";
import { addMonthsToDate, istDateString } from "@/lib/dates";
import { slugify } from "@/lib/format";
import { processListingPhoto, storeListingPhoto } from "@/lib/media";
import { newBillToken, saleItemFrom } from "@/lib/sales";
import { allPassed, type TestKey } from "@/lib/phone-tests";
import { DEFAULT_PRICING, estimatePrice } from "@/lib/pricing";
import { encryptString, keyedHash, randomToken, sha256Hex } from "@/lib/security/crypto";
import { hashPassword } from "@/lib/security/password";
import type { SellAnswers } from "@/lib/sell-quiz";
import { backSvg, frontSvg } from "./placeholder-images";
import { SEED_LISTINGS, SEED_MODELS } from "./seed-data";

const DAY = 86400000;

function fullName(brand: string, name: string) {
  return brand.toLowerCase() === "apple" || name.toLowerCase().startsWith(brand.toLowerCase()) ? name : `${brand} ${name}`;
}

function fakeImei(seed: number) {
  const body = `35${String(100000000000 + seed * 7919).slice(0, 12)}`.slice(0, 14);
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    let d = Number(body[i]);
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return body + ((10 - (sum % 10)) % 10);
}

async function main() {
  const force = process.argv.includes("--force");
  if (process.env.DATABASE_URL && !force) {
    console.error("DATABASE_URL is set. The seed only runs on the local database unless you pass --force.");
    process.exit(1);
  }

  const db = await getDb();
  const existing = await db.select({ id: schema.shopSettings.id }).from(schema.shopSettings).limit(1);
  if (existing.length > 0 && !process.argv.includes("--reset")) {
    console.log("Database already has data. Run `npm run db:reset` to start fresh.");
    await closeDb();
    return;
  }
  if (existing.length > 0) {
    await db.execute(sql`TRUNCATE TABLE
      listing_stats, listing_photos, sales, sell_request_events, sell_request_photos, sell_requests,
      wanted_requests, buy_prices, listings, phone_models, media, audit_log, admin_recovery_codes,
      admin_sessions, admin_users, rate_limits, counters, shop_settings RESTART IDENTITY CASCADE`);
  }

  const siteUrl = process.env.SITE_URL ?? "http://localhost:3000";
  await db.insert(schema.shopSettings).values({
    id: 1,
    shopName: "Shiva Mobiles",
    taglineEn: "Checked second-hand phones with shop warranty.",
    taglineTe: "పరీక్షించిన సెకండ్ హ్యాండ్ ఫోన్లు, షాప్ వారంటీతో.",
    phone: "+91 90000 00000",
    whatsapp: "919000000000",
    addressEn: "Main Road, near the Bus Stand, Andhra Pradesh",
    addressTe: "మెయిన్ రోడ్, బస్ స్టాండ్ దగ్గర, ఆంధ్రప్రదేశ్",
    town: "",
    mapUrl: "https://maps.google.com/?q=Shiva+Mobiles",
    hoursEn: "Every day, 9:30 am to 9:30 pm",
    hoursTe: "ప్రతి రోజు, ఉదయం 9:30 నుంచి రాత్రి 9:30 వరకు",
    googleReviewUrl: "",
    siteUrl,
    defaultWarrantyMonths: 3,
    retentionDays: 365,
    pricing: DEFAULT_PRICING,
  });

  // Owner account
  const password = process.env.SEED_ADMIN_PASSWORD || `demo-${randomToken(9)}`;
  const [owner] = await db
    .insert(schema.adminUsers)
    .values({ username: "owner", name: "Owner", role: "owner", passwordHash: await hashPassword(password) })
    .returning();

  // Catalog
  const modelIds = new Map<string, { id: string; brand: string; name: string; variants: (typeof SEED_MODELS)[number]["variants"] }>();
  for (const m of SEED_MODELS) {
    const [row] = await db
      .insert(schema.phoneModels)
      .values({
        brand: m.brand,
        name: m.name,
        slug: slugify(`${m.brand} ${m.name}`),
        aliases: m.aliases ?? [],
        os: m.os,
        launchYear: m.launchYear,
        chipset: m.chipset,
        performance: m.performance,
        displayInches: m.displayInches,
        displayType: m.displayType,
        refreshHz: m.refreshHz,
        mainCameraMp: m.mainCameraMp,
        cameraSummary: m.cameraSummary,
        frontCameraMp: m.frontCameraMp,
        batteryMah: m.batteryMah,
        chargingW: m.chargingW,
        has5g: m.has5g,
        weightG: m.weightG,
        variants: m.variants,
        specSource: "seed",
      })
      .returning({ id: schema.phoneModels.id });
    modelIds.set(fullName(m.brand, m.name), { id: row.id, brand: m.brand, name: m.name, variants: m.variants });
    for (const [storage, price] of Object.entries(m.buyPrices ?? {})) {
      await db.insert(schema.buyPrices).values({ modelId: row.id, storageGb: Number(storage), basePriceInr: price });
    }
  }

  // Demo phones with placeholder photos
  const now = Date.now();
  let index = 0;
  for (const item of SEED_LISTINGS) {
    index++;
    const model = modelIds.get(item.model) ?? [...modelIds.values()].find((m) => m.name === item.model);
    if (!model) throw new Error(`Seed listing refers to unknown model ${item.model}`);
    const code = `SM-${pad(await nextCounter("listing"))}`;
    const name = fullName(model.brand, model.name);
    const storageLabel = item.storageGb >= 1024 ? `${item.storageGb / 1024}tb` : `${item.storageGb}gb`;
    const slug = `${slugify(name)}-${storageLabel}-${code.toLowerCase()}`;
    const variant = model.variants.find((v) => v.storageGb === item.storageGb) ?? model.variants[0];
    const tests = allPassed();
    for (const failed of item.failed ?? []) tests[failed as TestKey] = false;
    if (model.brand !== "Apple" && model.name.includes("A14")) delete tests.biometric;
    const publishedAt = new Date(now - item.daysAgo * DAY - index * 3600000);
    const imei = fakeImei(index);
    const [listing] = await db
      .insert(schema.listings)
      .values({
        code,
        slug,
        modelId: model.id,
        ramGb: item.ramGb,
        storageGb: item.storageGb,
        color: item.color,
        grade: item.grade,
        batteryHealth: item.batteryHealth,
        batteryNote: item.batteryNote ?? null,
        priceInr: item.priceInr,
        launchPriceInr: variant?.launchPriceInr ?? null,
        previousPriceInr: item.previousPriceInr ?? null,
        priceDroppedAt: item.previousPriceInr ? new Date(now - 2 * DAY) : null,
        costInr: item.costInr,
        warrantyMonths: item.warrantyMonths ?? 3,
        hasBox: item.hasBox ?? false,
        hasCharger: item.hasCharger ?? false,
        hasBill: item.hasBill ?? false,
        tests,
        notesEn: item.notesEn ?? "",
        notesTe: item.notesTe ?? "",
        shopTags: item.shopTags ?? [],
        featured: item.featured ?? false,
        imeiEnc: await encryptString(imei, "imei"),
        imeiLast4: imei.slice(-4),
        imeiStatus: "clear",
        imeiCheckedAt: new Date(publishedAt.getTime() - 3600000),
        imeiCheckRef: "DEMO",
        status: item.status === "draft" ? "draft" : (item.status ?? "available"),
        publishedAt,
        reservedAt: item.status === "reserved" ? new Date(now - DAY) : null,
        soldAt: item.soldDaysAgo ? new Date(now - item.soldDaysAgo * DAY) : null,
        createdBy: owner.id,
        createdAt: publishedAt,
      })
      .returning({ id: schema.listings.id });

    const shots = [backSvg(item.hex, item.camera), frontSvg(item.hex, item.camera)];
    let position = 0;
    for (const svg of shots) {
      const png = await sharp(Buffer.from(svg)).png().toBuffer();
      const processed = await processListingPhoto(png, "Shiva Mobiles");
      const stored = await storeListingPhoto(processed);
      await db.insert(schema.listingPhotos).values({ listingId: listing.id, position: position++, ...stored });
    }

    if (item.status === "sold" && item.soldDaysAgo) {
      const soldAt = new Date(now - item.soldDaysAgo * DAY);
      const soldDay = istDateString(soldAt);
      const year = soldDay.slice(0, 4);
      const [full] = await db.select().from(schema.listings).where(eq(schema.listings.id, listing.id)).limit(1);
      const { tokenHash, tokenEnc } = await newBillToken();
      await db.insert(schema.sales).values({
        listingId: listing.id,
        billNo: `SB-${year}-${pad(await nextCounter(`bill-${year}`))}`,
        tokenHash,
        tokenEnc,
        item: saleItemFrom(full, model.brand, model.name),
        imeiEnc: full.imeiEnc,
        buyerName: index % 2 ? "Ravi Kumar" : "Lakshmi P",
        buyerPhone: `90000000${String(index).padStart(2, "0")}`,
        soldPriceInr: item.priceInr - 500,
        paymentMode: "upi",
        warrantyMonths: item.warrantyMonths ?? 3,
        warrantyUntil: addMonthsToDate(soldDay, item.warrantyMonths ?? 3),
        createdBy: owner.id,
        createdAt: soldAt,
      });
    }
    process.stdout.write(".");
  }
  process.stdout.write("\n");

  // Sell requests
  const requests: {
    model: string;
    storage: number;
    answers: SellAnswers;
    name: string;
    phone: string;
    area: string;
    status: "new" | "offer_sent" | "contacted";
    hoursAgo: number;
    offer?: number;
  }[] = [
    {
      model: "iPhone 12",
      storage: 128,
      answers: { power: "yes", screen: "scratches", body: "marks", battery: "good", faults: [], extras: ["box", "charger"] },
      name: "Srinivas R",
      phone: "9000000101",
      area: "Narasaraopet",
      status: "new",
      hoursAgo: 2,
    },
    {
      model: "Redmi Note 12 Pro 5G",
      storage: 128,
      answers: { power: "yes", screen: "perfect", body: "perfect", battery: "weak", faults: ["camera"], extras: ["box", "charger", "bill"] },
      name: "Anjali M",
      phone: "9000000102",
      area: "Chilakaluripet",
      status: "offer_sent",
      hoursAgo: 26,
      offer: 6500,
    },
    {
      model: "Samsung Galaxy S21 FE 5G",
      storage: 128,
      answers: { power: "yes", screen: "cracked", body: "marks", battery: "good", faults: [], extras: [] },
      name: "Mahesh",
      phone: "9000000103",
      area: "Vinukonda",
      status: "contacted",
      hoursAgo: 50,
    },
  ];
  for (const r of requests) {
    const model = modelIds.get(r.model) ?? [...modelIds.values()].find((m) => fullName(m.brand, m.name) === r.model);
    const base = model ? await db.execute(sql`SELECT base_price_inr FROM buy_prices WHERE model_id = ${model.id} AND storage_gb = ${r.storage} LIMIT 1`) : null;
    const baseRows = base ? ((Array.isArray(base) ? base : (base as { rows: { base_price_inr: number }[] }).rows) as { base_price_inr: number }[]) : [];
    const estimate = estimatePrice(baseRows[0]?.base_price_inr ?? null, r.answers, DEFAULT_PRICING);
    const created = new Date(now - r.hoursAgo * 3600000);
    const [req] = await db
      .insert(schema.sellRequests)
      .values({
        code: `SR-${pad(await nextCounter("sell"))}`,
        tokenHash: await sha256Hex(randomToken(24)),
        modelId: model?.id ?? null,
        modelText: model ? fullName(model.brand, model.name) : r.model,
        storageGb: r.storage,
        answers: r.answers,
        estimateMin: estimate?.min ?? null,
        estimateMax: estimate?.max ?? null,
        name: r.name,
        phone: r.phone,
        area: r.area,
        preferredContact: "whatsapp",
        status: r.status,
        offerPrice: r.offer ?? null,
        consentAt: created,
        createdAt: created,
        updatedAt: created,
      })
      .returning({ id: schema.sellRequests.id });
    await db.insert(schema.sellRequestEvents).values({ requestId: req.id, status: "new", at: created });
    if (r.status !== "new") {
      await db.insert(schema.sellRequestEvents).values({
        requestId: req.id,
        status: r.status,
        publicNote: r.offer ? `We can offer ₹${r.offer.toLocaleString("en-IN")} after a quick check.` : null,
        byUserId: owner.id,
        at: new Date(created.getTime() + 3 * 3600000),
      });
    }
  }

  // Notify-me list
  await db.insert(schema.wantedRequests).values([
    {
      name: "Karthik",
      phone: "9000000201",
      wantText: "iPhone 13 or 14, good battery",
      maxBudget: 35000,
      consentAt: new Date(),
      createdAt: new Date(now - 3 * DAY),
    },
    {
      name: "Divya",
      phone: "9000000202",
      wantText: "Any 5G phone with big battery for my father",
      maxBudget: 12000,
      consentAt: new Date(),
      createdAt: new Date(now - DAY),
    },
  ]);

  await db.insert(schema.auditLog).values({ userId: owner.id, userName: owner.name, action: "seed", details: { note: "Demo data loaded" } });

  // Touch keyedHash so the dev secret file exists before the app starts.
  await keyedHash("warm-up");

  console.log("\nDemo data ready.");
  console.log("Admin login:  username: owner");
  console.log(`              password: ${password}`);
  console.log("You will set up the authenticator app on first login.");
  await closeDb();
}

main().catch(async (error) => {
  console.error(error);
  await closeDb().catch(() => {});
  process.exit(1);
});
