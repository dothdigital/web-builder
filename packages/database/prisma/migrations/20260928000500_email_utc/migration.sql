-- Prisma DateTime is timestamp without time zone; keep defaults UTC on any server.
ALTER TABLE "EmailContact" ALTER COLUMN "createdAt" SET DEFAULT timezone('UTC', CURRENT_TIMESTAMP);
ALTER TABLE "EmailCampaign" ALTER COLUMN "createdAt" SET DEFAULT timezone('UTC', CURRENT_TIMESTAMP);
ALTER TABLE "EmailDelivery" ALTER COLUMN "createdAt" SET DEFAULT timezone('UTC', CURRENT_TIMESTAMP);
ALTER TABLE "EmailDelivery" ALTER COLUMN "nextAttemptAt" SET DEFAULT timezone('UTC', CURRENT_TIMESTAMP);
