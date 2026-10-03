CREATE TABLE "ContentJob" (
 "id" TEXT PRIMARY KEY, "projectId" TEXT NOT NULL REFERENCES "Project"("id") ON DELETE CASCADE,
 "workspaceId" TEXT NOT NULL, "requestedBy" TEXT NOT NULL, "kind" TEXT NOT NULL, "title" TEXT NOT NULL,
 "status" TEXT NOT NULL DEFAULT 'QUEUED', "dedupeKey" TEXT UNIQUE, "input" JSONB NOT NULL, "result" JSONB,
 "error" TEXT, "attempts" INTEGER NOT NULL DEFAULT 0, "runToken" TEXT, "emailTo" TEXT,
 "emailStatus" TEXT NOT NULL DEFAULT 'PENDING', "emailAttempts" INTEGER NOT NULL DEFAULT 0,
 "emailNextAttemptAt" TIMESTAMP(3), "emailLeaseUntil" TIMESTAMP(3), "startedAt" TIMESTAMP(3), "finishedAt" TIMESTAMP(3),
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE INDEX "ContentJob_workspaceId_status_idx" ON "ContentJob"("workspaceId", "status");
CREATE INDEX "ContentJob_status_createdAt_idx" ON "ContentJob"("status", "createdAt");
CREATE INDEX "ContentJob_projectId_createdAt_idx" ON "ContentJob"("projectId", "createdAt");
CREATE INDEX "ContentJob_emailStatus_emailNextAttemptAt_idx" ON "ContentJob"("emailStatus", "emailNextAttemptAt");
