CREATE TABLE "WebsiteVisit" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "projectId" TEXT NOT NULL REFERENCES "Project"("id") ON DELETE CASCADE,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "visitorHash" TEXT NOT NULL,
  "pagePath" TEXT NOT NULL,
  "referrer" TEXT NOT NULL,
  "country" TEXT,
  "city" TEXT
);
CREATE INDEX "WebsiteVisit_projectId_occurredAt_idx" ON "WebsiteVisit"("projectId", "occurredAt");
