CREATE TABLE "TransactionalEmail" (
  "id" TEXT NOT NULL,
  "dedupeKey" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "recipient" TEXT NOT NULL,
  "subject" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "html" TEXT,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "sentAt" TIMESTAMP(3),
  "lastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TransactionalEmail_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "TransactionalEmail_dedupeKey_key" ON "TransactionalEmail"("dedupeKey");
CREATE INDEX "TransactionalEmail_status_nextAttemptAt_idx" ON "TransactionalEmail"("status", "nextAttemptAt");
