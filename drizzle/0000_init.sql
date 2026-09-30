CREATE TABLE "admin_recovery_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"code_hash" text NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "admin_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"stage" text NOT NULL,
	"pending_totp_enc" text,
	"flash_enc" text,
	"failed_attempts" integer DEFAULT 0 NOT NULL,
	"ip" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "admin_users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" text NOT NULL,
	"name" text NOT NULL,
	"role" text DEFAULT 'staff' NOT NULL,
	"password_hash" text NOT NULL,
	"password_changed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"totp_secret_enc" text,
	"totp_enabled_at" timestamp with time zone,
	"totp_last_step" integer,
	"is_active" boolean DEFAULT true NOT NULL,
	"must_change_password" boolean DEFAULT false NOT NULL,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_id" uuid,
	"user_name" text,
	"action" text NOT NULL,
	"entity" text,
	"entity_id" text,
	"details" jsonb,
	"ip" text
);
--> statement-breakpoint
CREATE TABLE "buy_prices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"model_id" uuid NOT NULL,
	"storage_gb" smallint NOT NULL,
	"base_price_inr" integer NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "counters" (
	"name" text PRIMARY KEY NOT NULL,
	"value" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "listing_photos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"listing_id" uuid NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"sm_id" uuid NOT NULL,
	"md_id" uuid NOT NULL,
	"lg_id" uuid NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "listing_stats" (
	"listing_id" uuid NOT NULL,
	"day" date NOT NULL,
	"views" integer DEFAULT 0 NOT NULL,
	"whatsapp_views" integer DEFAULT 0 NOT NULL,
	"whatsapp_clicks" integer DEFAULT 0 NOT NULL,
	"call_clicks" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "listing_stats_listing_id_day_pk" PRIMARY KEY("listing_id","day")
);
--> statement-breakpoint
CREATE TABLE "listings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"slug" text NOT NULL,
	"model_id" uuid NOT NULL,
	"ram_gb" smallint,
	"storage_gb" smallint NOT NULL,
	"color" text DEFAULT '' NOT NULL,
	"grade" text NOT NULL,
	"battery_health" smallint,
	"battery_note" text,
	"price_inr" integer NOT NULL,
	"launch_price_inr" integer,
	"previous_price_inr" integer,
	"price_dropped_at" timestamp with time zone,
	"cost_inr" integer,
	"warranty_months" smallint DEFAULT 3 NOT NULL,
	"brand_warranty_until" date,
	"has_box" boolean DEFAULT false NOT NULL,
	"has_charger" boolean DEFAULT false NOT NULL,
	"has_bill" boolean DEFAULT false NOT NULL,
	"tests" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"notes_en" text DEFAULT '' NOT NULL,
	"notes_te" text DEFAULT '' NOT NULL,
	"shop_tags" text[] DEFAULT '{}'::text[] NOT NULL,
	"featured" boolean DEFAULT false NOT NULL,
	"imei_enc" text,
	"imei_last4" text,
	"imei_status" text DEFAULT 'pending' NOT NULL,
	"imei_checked_at" timestamp with time zone,
	"imei_check_ref" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"published_at" timestamp with time zone,
	"reserved_at" timestamp with time zone,
	"sold_at" timestamp with time zone,
	"source_request_id" uuid,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "media" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"is_private" boolean DEFAULT false NOT NULL,
	"content_type" text NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"bytes" "bytea" NOT NULL,
	"size" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "phone_models" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand" text NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"aliases" text[] DEFAULT '{}'::text[] NOT NULL,
	"os" text NOT NULL,
	"launch_year" smallint,
	"chipset" text,
	"performance" smallint,
	"display_inches" real,
	"display_type" text,
	"refresh_hz" smallint,
	"main_camera_mp" smallint,
	"camera_summary" text,
	"front_camera_mp" smallint,
	"battery_mah" integer,
	"charging_w" smallint,
	"has_5g" boolean DEFAULT false NOT NULL,
	"weight_g" smallint,
	"variants" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"spec_source" text DEFAULT 'manual' NOT NULL,
	"source_urls" text[] DEFAULT '{}'::text[] NOT NULL,
	"verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rate_limits" (
	"key" text PRIMARY KEY NOT NULL,
	"window_start" timestamp with time zone DEFAULT now() NOT NULL,
	"count" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sales" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"listing_id" uuid NOT NULL,
	"bill_no" text NOT NULL,
	"token_hash" text NOT NULL,
	"token_enc" text NOT NULL,
	"buyer_name" text NOT NULL,
	"buyer_phone" text NOT NULL,
	"sold_price_inr" integer NOT NULL,
	"payment_mode" text DEFAULT 'cash' NOT NULL,
	"warranty_months" smallint NOT NULL,
	"warranty_until" date NOT NULL,
	"item" jsonb NOT NULL,
	"imei_enc" text,
	"voided_at" timestamp with time zone,
	"voided_by" uuid,
	"review_requested_at" timestamp with time zone,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sell_request_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"status" text NOT NULL,
	"public_note" text,
	"by_user_id" uuid,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sell_request_photos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"media_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sell_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"token_hash" text NOT NULL,
	"model_id" uuid,
	"model_text" text NOT NULL,
	"storage_gb" smallint,
	"answers" jsonb NOT NULL,
	"estimate_min" integer,
	"estimate_max" integer,
	"expected_price" integer,
	"name" text NOT NULL,
	"phone" text NOT NULL,
	"area" text NOT NULL,
	"pincode" text,
	"preferred_contact" text DEFAULT 'whatsapp' NOT NULL,
	"wants_exchange" boolean DEFAULT false NOT NULL,
	"status" text DEFAULT 'new' NOT NULL,
	"offer_price" integer,
	"pickup_at" timestamp with time zone,
	"admin_notes" text DEFAULT '' NOT NULL,
	"lang" text DEFAULT 'en' NOT NULL,
	"consent_at" timestamp with time zone NOT NULL,
	"closed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shop_settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"shop_name" text DEFAULT 'Shiva Mobiles' NOT NULL,
	"tagline_en" text DEFAULT '' NOT NULL,
	"tagline_te" text DEFAULT '' NOT NULL,
	"phone" text DEFAULT '' NOT NULL,
	"whatsapp" text DEFAULT '' NOT NULL,
	"address_en" text DEFAULT '' NOT NULL,
	"address_te" text DEFAULT '' NOT NULL,
	"town" text DEFAULT '' NOT NULL,
	"map_url" text DEFAULT '' NOT NULL,
	"hours_en" text DEFAULT '' NOT NULL,
	"hours_te" text DEFAULT '' NOT NULL,
	"google_review_url" text DEFAULT '' NOT NULL,
	"gstin" text DEFAULT '' NOT NULL,
	"site_url" text DEFAULT '' NOT NULL,
	"default_warranty_months" integer DEFAULT 3 NOT NULL,
	"retention_days" integer DEFAULT 365 NOT NULL,
	"pricing" jsonb,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wanted_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"phone" text NOT NULL,
	"want_text" text NOT NULL,
	"model_id" uuid,
	"max_budget" integer,
	"status" text DEFAULT 'open' NOT NULL,
	"notified_at" timestamp with time zone,
	"lang" text DEFAULT 'en' NOT NULL,
	"consent_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "admin_recovery_codes" ADD CONSTRAINT "admin_recovery_codes_user_id_admin_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."admin_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_sessions" ADD CONSTRAINT "admin_sessions_user_id_admin_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."admin_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_user_id_admin_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."admin_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "buy_prices" ADD CONSTRAINT "buy_prices_model_id_phone_models_id_fk" FOREIGN KEY ("model_id") REFERENCES "public"."phone_models"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_photos" ADD CONSTRAINT "listing_photos_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_stats" ADD CONSTRAINT "listing_stats_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "listings_model_id_phone_models_id_fk" FOREIGN KEY ("model_id") REFERENCES "public"."phone_models"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "listings_created_by_admin_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."admin_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_voided_by_admin_users_id_fk" FOREIGN KEY ("voided_by") REFERENCES "public"."admin_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_created_by_admin_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."admin_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sell_request_events" ADD CONSTRAINT "sell_request_events_request_id_sell_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."sell_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sell_request_events" ADD CONSTRAINT "sell_request_events_by_user_id_admin_users_id_fk" FOREIGN KEY ("by_user_id") REFERENCES "public"."admin_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sell_request_photos" ADD CONSTRAINT "sell_request_photos_request_id_sell_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."sell_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sell_requests" ADD CONSTRAINT "sell_requests_model_id_phone_models_id_fk" FOREIGN KEY ("model_id") REFERENCES "public"."phone_models"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wanted_requests" ADD CONSTRAINT "wanted_requests_model_id_phone_models_id_fk" FOREIGN KEY ("model_id") REFERENCES "public"."phone_models"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "admin_recovery_user_idx" ON "admin_recovery_codes" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "admin_sessions_user_idx" ON "admin_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "admin_users_username_idx" ON "admin_users" USING btree ("username");--> statement-breakpoint
CREATE INDEX "audit_log_at_idx" ON "audit_log" USING btree ("at");--> statement-breakpoint
CREATE UNIQUE INDEX "buy_prices_model_storage_idx" ON "buy_prices" USING btree ("model_id","storage_gb");--> statement-breakpoint
CREATE INDEX "listing_photos_listing_idx" ON "listing_photos" USING btree ("listing_id");--> statement-breakpoint
CREATE UNIQUE INDEX "listings_code_idx" ON "listings" USING btree ("code");--> statement-breakpoint
CREATE UNIQUE INDEX "listings_slug_idx" ON "listings" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "listings_status_idx" ON "listings" USING btree ("status");--> statement-breakpoint
CREATE INDEX "listings_model_idx" ON "listings" USING btree ("model_id");--> statement-breakpoint
CREATE UNIQUE INDEX "phone_models_slug_idx" ON "phone_models" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "phone_models_brand_idx" ON "phone_models" USING btree ("brand");--> statement-breakpoint
CREATE UNIQUE INDEX "sales_listing_active_idx" ON "sales" USING btree ("listing_id") WHERE "sales"."voided_at" is null;--> statement-breakpoint
CREATE INDEX "sales_listing_idx" ON "sales" USING btree ("listing_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sales_bill_idx" ON "sales" USING btree ("bill_no");--> statement-breakpoint
CREATE UNIQUE INDEX "sales_token_idx" ON "sales" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "sales_phone_idx" ON "sales" USING btree ("buyer_phone");--> statement-breakpoint
CREATE INDEX "sell_request_events_req_idx" ON "sell_request_events" USING btree ("request_id");--> statement-breakpoint
CREATE INDEX "sell_request_photos_req_idx" ON "sell_request_photos" USING btree ("request_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sell_requests_code_idx" ON "sell_requests" USING btree ("code");--> statement-breakpoint
CREATE UNIQUE INDEX "sell_requests_token_idx" ON "sell_requests" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "sell_requests_status_idx" ON "sell_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "wanted_status_idx" ON "wanted_requests" USING btree ("status");