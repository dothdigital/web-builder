ALTER TABLE "BusinessProfile" ADD COLUMN "phones" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
UPDATE "BusinessProfile" SET "phones" = ARRAY["phone"] WHERE "phone" IS NOT NULL AND btrim("phone") <> '';
