-- Prisma represents timestamp-without-time-zone as UTC. Do not cast the
-- database session's local timezone into a trial deadline.
ALTER TABLE "Workspace" ALTER COLUMN "trialEndsAt" SET DEFAULT (timezone('UTC', CURRENT_TIMESTAMP) + INTERVAL '7 days');
