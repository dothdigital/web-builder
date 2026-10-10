ALTER TABLE "Domain" ADD COLUMN "cloudflareHostnameId" TEXT;
ALTER TABLE "Domain" ADD COLUMN "cloudflareValidation" JSONB;
CREATE UNIQUE INDEX "Domain_cloudflareHostnameId_key" ON "Domain"("cloudflareHostnameId");
ALTER TABLE "HostingSite" ADD COLUMN "serverId" TEXT;
ALTER TABLE "HostingSite" ADD COLUMN "publicHost" TEXT;
CREATE UNIQUE INDEX "HostingSite_publicHost_key" ON "HostingSite"("publicHost");
CREATE INDEX "HostingSite_serverId_idx" ON "HostingSite"("serverId");
ALTER TABLE "HostingSite" ADD COLUMN "storagePrefix" TEXT;
