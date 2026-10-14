ALTER TABLE "PublishRelease" ADD COLUMN "isPreview" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "HostingSite" ADD COLUMN "previewHost" TEXT;
ALTER TABLE "HostingSite" ADD COLUMN "previewDeployedReleaseId" TEXT;
ALTER TABLE "HostingSite" ADD COLUMN "previewPendingReleaseId" TEXT;
ALTER TABLE "HostingSite" ADD COLUMN "previewStatus" TEXT NOT NULL DEFAULT 'NOT_CREATED';
ALTER TABLE "HostingSite" ADD COLUMN "previewLastError" TEXT;
CREATE UNIQUE INDEX "HostingSite_previewHost_key" ON "HostingSite"("previewHost");
