ALTER TABLE "Domain" ADD COLUMN "dnsReady" BOOLEAN NOT NULL DEFAULT false, ADD COLUMN "lastCheckedAt" TIMESTAMP(3), ADD COLUMN "lastError" TEXT;
CREATE TABLE "HostingSite" (
  "projectId" TEXT PRIMARY KEY REFERENCES "Project"("id") ON DELETE CASCADE,
  "distributionId" TEXT UNIQUE, "distributionHost" TEXT, "certificateArn" TEXT, "functionArn" TEXT,
  "deployedReleaseId" TEXT, "pendingReleaseId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'NOT_CONFIGURED', "lastError" TEXT,
  "lockUntil" TIMESTAMP(3), "lockToken" TEXT, "updatedAt" TIMESTAMP(3) NOT NULL
);
