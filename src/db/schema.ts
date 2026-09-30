import { sql } from "drizzle-orm";
import {
  bigserial,
  boolean,
  customType,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  real,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import type { PricingRules } from "@/lib/pricing";
import type { SellAnswers } from "@/lib/sell-quiz";
import type { TestResults } from "@/lib/phone-tests";

/** Postgres bytea column that always hands back a Uint8Array. */
const bytea = customType<{ data: Uint8Array; driverData: Uint8Array }>({
  dataType() {
    return "bytea";
  },
  toDriver(value) {
    return Buffer.from(value);
  },
  fromDriver(value) {
    return value instanceof Uint8Array ? value : new Uint8Array(value as ArrayBuffer);
  },
});

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () => timestamp("updated_at", { withTimezone: true }).notNull().defaultNow();

// ---------------------------------------------------------------------------
// Shop
// ---------------------------------------------------------------------------

export const shopSettings = pgTable("shop_settings", {
  id: integer("id").primaryKey().default(1),
  shopName: text("shop_name").notNull().default("Shiva Mobiles"),
  taglineEn: text("tagline_en").notNull().default(""),
  taglineTe: text("tagline_te").notNull().default(""),
  phone: text("phone").notNull().default(""),
  /** Digits only, with country code, e.g. 919876543210 */
  whatsapp: text("whatsapp").notNull().default(""),
  addressEn: text("address_en").notNull().default(""),
  addressTe: text("address_te").notNull().default(""),
  town: text("town").notNull().default(""),
  mapUrl: text("map_url").notNull().default(""),
  hoursEn: text("hours_en").notNull().default(""),
  hoursTe: text("hours_te").notNull().default(""),
  googleReviewUrl: text("google_review_url").notNull().default(""),
  /** Printed on bills when the shop is GST registered */
  gstin: text("gstin").notNull().default(""),
  siteUrl: text("site_url").notNull().default(""),
  defaultWarrantyMonths: integer("default_warranty_months").notNull().default(3),
  /** Days after its last update before a sell request (and its photos) is deleted */
  retentionDays: integer("retention_days").notNull().default(365),
  pricing: jsonb("pricing").$type<PricingRules>(),
  updatedAt: updatedAt(),
});

/** Atomic counters for human-friendly codes (SM-0001, SR-0001, bills). */
export const counters = pgTable("counters", {
  name: text("name").primaryKey(),
  value: integer("value").notNull().default(0),
});

// ---------------------------------------------------------------------------
// Admin accounts and security
// ---------------------------------------------------------------------------

export type AdminRole = "owner" | "staff";

export const adminUsers = pgTable(
  "admin_users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    username: text("username").notNull(),
    name: text("name").notNull(),
    role: text("role").$type<AdminRole>().notNull().default("staff"),
    passwordHash: text("password_hash").notNull(),
    passwordChangedAt: timestamp("password_changed_at", { withTimezone: true }).notNull().defaultNow(),
    /** AES-GCM encrypted TOTP secret (base32) once 2FA is switched on */
    totpSecretEnc: text("totp_secret_enc"),
    totpEnabledAt: timestamp("totp_enabled_at", { withTimezone: true }),
    /** Last accepted TOTP time-step, to stop the same code being reused */
    totpLastStep: integer("totp_last_step"),
    isActive: boolean("is_active").notNull().default(true),
    /** Set when the owner gives a temporary password; cleared once changed */
    mustChangePassword: boolean("must_change_password").notNull().default(false),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("admin_users_username_idx").on(t.username)],
);

export type SessionStage = "mfa_pending" | "setup_2fa" | "full";

export const adminSessions = pgTable(
  "admin_sessions",
  {
    /** SHA-256 hex of the cookie token; the raw token is never stored */
    id: text("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => adminUsers.id, { onDelete: "cascade" }),
    stage: text("stage").$type<SessionStage>().notNull(),
    /** Encrypted TOTP secret being set up (only during setup_2fa) */
    pendingTotpEnc: text("pending_totp_enc"),
    /** Encrypted one-time message for the next page (new recovery codes) */
    flashEnc: text("flash_enc"),
    failedAttempts: integer("failed_attempts").notNull().default(0),
    ip: text("ip"),
    userAgent: text("user_agent"),
    createdAt: createdAt(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (t) => [index("admin_sessions_user_idx").on(t.userId)],
);

export const adminRecoveryCodes = pgTable(
  "admin_recovery_codes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => adminUsers.id, { onDelete: "cascade" }),
    codeHash: text("code_hash").notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index("admin_recovery_user_idx").on(t.userId)],
);

export const auditLog = pgTable(
  "audit_log",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
    userId: uuid("user_id").references(() => adminUsers.id, { onDelete: "set null" }),
    userName: text("user_name"),
    action: text("action").notNull(),
    entity: text("entity"),
    entityId: text("entity_id"),
    details: jsonb("details").$type<Record<string, unknown>>(),
    ip: text("ip"),
  },
  (t) => [index("audit_log_at_idx").on(t.at)],
);

export const rateLimits = pgTable("rate_limits", {
  key: text("key").primaryKey(),
  windowStart: timestamp("window_start", { withTimezone: true }).notNull().defaultNow(),
  count: integer("count").notNull().default(0),
});

// ---------------------------------------------------------------------------
// Media (photos stored in Postgres, served from /media/<id>.webp)
// ---------------------------------------------------------------------------

export const media = pgTable("media", {
  id: uuid("id").primaryKey().defaultRandom(),
  isPrivate: boolean("is_private").notNull().default(false),
  contentType: text("content_type").notNull(),
  width: integer("width").notNull(),
  height: integer("height").notNull(),
  bytes: bytea("bytes").notNull(),
  size: integer("size").notNull(),
  createdAt: createdAt(),
});

// ---------------------------------------------------------------------------
// Phone catalog (one row per model, shared by every unit of that model)
// ---------------------------------------------------------------------------

export type ModelVariant = { ramGb: number | null; storageGb: number; launchPriceInr: number | null };
export type SpecSource = "seed" | "ai" | "gsmarena" | "wikipedia" | "pasted" | "manual";

export const phoneModels = pgTable(
  "phone_models",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    brand: text("brand").notNull(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    /** Model numbers and other names people type, e.g. SM-A546E, A2633 */
    aliases: text("aliases")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    os: text("os").$type<"iOS" | "Android">().notNull(),
    launchYear: smallint("launch_year"),
    chipset: text("chipset"),
    /** 1 basic, 2 good, 3 fast, 4 flagship */
    performance: smallint("performance"),
    displayInches: real("display_inches"),
    displayType: text("display_type"),
    refreshHz: smallint("refresh_hz"),
    mainCameraMp: smallint("main_camera_mp"),
    cameraSummary: text("camera_summary"),
    frontCameraMp: smallint("front_camera_mp"),
    batteryMah: integer("battery_mah"),
    chargingW: smallint("charging_w"),
    has5g: boolean("has_5g").notNull().default(false),
    weightG: smallint("weight_g"),
    variants: jsonb("variants")
      .$type<ModelVariant[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    specSource: text("spec_source").$type<SpecSource>().notNull().default("manual"),
    sourceUrls: text("source_urls")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("phone_models_slug_idx").on(t.slug), index("phone_models_brand_idx").on(t.brand)],
);

// ---------------------------------------------------------------------------
// Listings (each physical phone in the shop)
// ---------------------------------------------------------------------------

export type ListingStatus = "draft" | "available" | "reserved" | "sold" | "hidden";
export type Grade = "A" | "B" | "C";
export type ImeiStatus = "pending" | "clear" | "blocked";

export const listings = pgTable(
  "listings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: text("code").notNull(),
    slug: text("slug").notNull(),
    modelId: uuid("model_id")
      .notNull()
      .references(() => phoneModels.id, { onDelete: "restrict" }),
    ramGb: smallint("ram_gb"),
    storageGb: smallint("storage_gb").notNull(),
    color: text("color").notNull().default(""),
    grade: text("grade").$type<Grade>().notNull(),
    batteryHealth: smallint("battery_health"),
    batteryNote: text("battery_note"),
    priceInr: integer("price_inr").notNull(),
    /** Price of this variant when new (copied from the catalog, editable) */
    launchPriceInr: integer("launch_price_inr"),
    previousPriceInr: integer("previous_price_inr"),
    priceDroppedAt: timestamp("price_dropped_at", { withTimezone: true }),
    /** What the shop paid. Owner-only; never shown publicly. */
    costInr: integer("cost_inr"),
    warrantyMonths: smallint("warranty_months").notNull().default(3),
    brandWarrantyUntil: date("brand_warranty_until"),
    hasBox: boolean("has_box").notNull().default(false),
    hasCharger: boolean("has_charger").notNull().default(false),
    hasBill: boolean("has_bill").notNull().default(false),
    tests: jsonb("tests")
      .$type<TestResults>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    notesEn: text("notes_en").notNull().default(""),
    notesTe: text("notes_te").notNull().default(""),
    /** Uncle's own picks: gaming, camera, parents, students, office */
    shopTags: text("shop_tags")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    featured: boolean("featured").notNull().default(false),
    /**
     * Result of the government IMEI check. The IMEI number itself is never
     * stored: staff check it on the phone (*#06#) and record only the result.
     */
    imeiStatus: text("imei_status").$type<ImeiStatus>().notNull().default("pending"),
    imeiCheckedAt: timestamp("imei_checked_at", { withTimezone: true }),
    /** Optional receipt or reference number from the check (not the IMEI) */
    imeiCheckRef: text("imei_check_ref"),
    status: text("status").$type<ListingStatus>().notNull().default("draft"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    reservedAt: timestamp("reserved_at", { withTimezone: true }),
    soldAt: timestamp("sold_at", { withTimezone: true }),
    sourceRequestId: uuid("source_request_id"),
    createdBy: uuid("created_by").references(() => adminUsers.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("listings_code_idx").on(t.code),
    uniqueIndex("listings_slug_idx").on(t.slug),
    index("listings_status_idx").on(t.status),
    index("listings_model_idx").on(t.modelId),
  ],
);

export const listingPhotos = pgTable(
  "listing_photos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    listingId: uuid("listing_id")
      .notNull()
      .references(() => listings.id, { onDelete: "cascade" }),
    position: integer("position").notNull().default(0),
    smId: uuid("sm_id").notNull(),
    mdId: uuid("md_id").notNull(),
    lgId: uuid("lg_id").notNull(),
    width: integer("width").notNull(),
    height: integer("height").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("listing_photos_listing_idx").on(t.listingId)],
);

export const listingStats = pgTable(
  "listing_stats",
  {
    listingId: uuid("listing_id")
      .notNull()
      .references(() => listings.id, { onDelete: "cascade" }),
    day: date("day").notNull(),
    views: integer("views").notNull().default(0),
    whatsappViews: integer("whatsapp_views").notNull().default(0),
    whatsappClicks: integer("whatsapp_clicks").notNull().default(0),
    callClicks: integer("call_clicks").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.listingId, t.day] })],
);

// ---------------------------------------------------------------------------
// Sales (digital bill + warranty card)
// ---------------------------------------------------------------------------

export type PaymentMode = "cash" | "upi" | "card" | "other";

/** What was sold, copied at the moment of sale so a bill never changes later. */
export type SaleItem = {
  name: string;
  code: string;
  ramGb: number | null;
  storageGb: number;
  color: string;
  grade: Grade;
  batteryHealth: number | null;
  hasBox: boolean;
  hasCharger: boolean;
  hasBill: boolean;
  brandWarrantyUntil: string | null;
};

export const sales = pgTable(
  "sales",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    listingId: uuid("listing_id")
      .notNull()
      .references(() => listings.id, { onDelete: "restrict" }),
    billNo: text("bill_no").notNull(),
    /** SHA-256 of the private bill-link token; used to find the bill */
    tokenHash: text("token_hash").notNull(),
    /** The same token, encrypted, so the shop can send the link again */
    tokenEnc: text("token_enc").notNull(),
    buyerName: text("buyer_name").notNull(),
    buyerPhone: text("buyer_phone").notNull(),
    soldPriceInr: integer("sold_price_inr").notNull(),
    paymentMode: text("payment_mode").$type<PaymentMode>().notNull().default("cash"),
    warrantyMonths: smallint("warranty_months").notNull(),
    warrantyUntil: date("warranty_until").notNull(),
    item: jsonb("item").$type<SaleItem>().notNull(),
    /** Set when the owner cancels a sale; the bill stays, marked cancelled */
    voidedAt: timestamp("voided_at", { withTimezone: true }),
    voidedBy: uuid("voided_by").references(() => adminUsers.id, { onDelete: "set null" }),
    reviewRequestedAt: timestamp("review_requested_at", { withTimezone: true }),
    createdBy: uuid("created_by").references(() => adminUsers.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [
    // One active sale per phone; cancelled sales stay for the records.
    uniqueIndex("sales_listing_active_idx")
      .on(t.listingId)
      .where(sql`${t.voidedAt} is null`),
    index("sales_listing_idx").on(t.listingId),
    uniqueIndex("sales_bill_idx").on(t.billNo),
    uniqueIndex("sales_token_idx").on(t.tokenHash),
    index("sales_phone_idx").on(t.buyerPhone),
  ],
);

// ---------------------------------------------------------------------------
// Sell requests (customers selling their phone to the shop)
// ---------------------------------------------------------------------------

export type SellStatus = "new" | "contacted" | "offer_sent" | "pickup_scheduled" | "bought" | "rejected" | "cancelled";

export const sellRequests = pgTable(
  "sell_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: text("code").notNull(),
    /** SHA-256 of the private tracking token */
    tokenHash: text("token_hash").notNull(),
    modelId: uuid("model_id").references(() => phoneModels.id, { onDelete: "set null" }),
    modelText: text("model_text").notNull(),
    storageGb: smallint("storage_gb"),
    answers: jsonb("answers").$type<SellAnswers>().notNull(),
    estimateMin: integer("estimate_min"),
    estimateMax: integer("estimate_max"),
    expectedPrice: integer("expected_price"),
    name: text("name").notNull(),
    phone: text("phone").notNull(),
    area: text("area").notNull(),
    pincode: text("pincode"),
    preferredContact: text("preferred_contact").$type<"whatsapp" | "call">().notNull().default("whatsapp"),
    wantsExchange: boolean("wants_exchange").notNull().default(false),
    status: text("status").$type<SellStatus>().notNull().default("new"),
    offerPrice: integer("offer_price"),
    pickupAt: timestamp("pickup_at", { withTimezone: true }),
    adminNotes: text("admin_notes").notNull().default(""),
    lang: text("lang").$type<"en" | "te">().notNull().default("en"),
    consentAt: timestamp("consent_at", { withTimezone: true }).notNull(),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("sell_requests_code_idx").on(t.code),
    uniqueIndex("sell_requests_token_idx").on(t.tokenHash),
    index("sell_requests_status_idx").on(t.status),
  ],
);

export const sellRequestPhotos = pgTable(
  "sell_request_photos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    requestId: uuid("request_id")
      .notNull()
      .references(() => sellRequests.id, { onDelete: "cascade" }),
    mediaId: uuid("media_id").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("sell_request_photos_req_idx").on(t.requestId)],
);

export const sellRequestEvents = pgTable(
  "sell_request_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    requestId: uuid("request_id")
      .notNull()
      .references(() => sellRequests.id, { onDelete: "cascade" }),
    status: text("status").$type<SellStatus>().notNull(),
    /** Shown to the seller on their tracking page */
    publicNote: text("public_note"),
    byUserId: uuid("by_user_id").references(() => adminUsers.id, { onDelete: "set null" }),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("sell_request_events_req_idx").on(t.requestId)],
);

/** Uncle's buying price for a model + storage in "good" condition. */
export const buyPrices = pgTable(
  "buy_prices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    modelId: uuid("model_id")
      .notNull()
      .references(() => phoneModels.id, { onDelete: "cascade" }),
    storageGb: smallint("storage_gb").notNull(),
    basePriceInr: integer("base_price_inr").notNull(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("buy_prices_model_storage_idx").on(t.modelId, t.storageGb)],
);

// ---------------------------------------------------------------------------
// "Notify me" list
// ---------------------------------------------------------------------------

export type WantedStatus = "open" | "notified" | "closed";

export const wantedRequests = pgTable(
  "wanted_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    phone: text("phone").notNull(),
    wantText: text("want_text").notNull(),
    modelId: uuid("model_id").references(() => phoneModels.id, { onDelete: "set null" }),
    maxBudget: integer("max_budget"),
    status: text("status").$type<WantedStatus>().notNull().default("open"),
    notifiedAt: timestamp("notified_at", { withTimezone: true }),
    lang: text("lang").$type<"en" | "te">().notNull().default("en"),
    consentAt: timestamp("consent_at", { withTimezone: true }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("wanted_status_idx").on(t.status)],
);
