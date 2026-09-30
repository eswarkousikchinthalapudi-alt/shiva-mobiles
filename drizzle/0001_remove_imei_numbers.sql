ALTER TABLE "listings" DROP COLUMN "imei_enc";--> statement-breakpoint
ALTER TABLE "listings" DROP COLUMN "imei_last4";--> statement-breakpoint
ALTER TABLE "sales" DROP COLUMN "imei_enc";--> statement-breakpoint
-- Bills no longer show any IMEI digits: remove them from saved bill copies too.
UPDATE "sales" SET "item" = "item" - 'imeiLast4';
