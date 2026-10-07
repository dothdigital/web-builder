ALTER TABLE "User" ADD COLUMN "billingTrialUsedAt" TIMESTAMP(3),
  ADD COLUMN "billingTrialReservedUntil" TIMESTAMP(3);
ALTER TABLE "Workspace" ADD COLUMN "billingTrialEnd" TIMESTAMP(3),
  ADD COLUMN "billingTrialUsedAt" TIMESTAMP(3);
