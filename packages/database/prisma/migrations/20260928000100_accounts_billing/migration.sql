ALTER TABLE "User" ADD COLUMN "passwordHash" TEXT, ADD COLUMN "suspendedAt" TIMESTAMP(3), ADD COLUMN "sessionVersion" INTEGER NOT NULL DEFAULT 0;
CREATE TABLE "BillingPlan" ("id" TEXT PRIMARY KEY, "slug" TEXT NOT NULL UNIQUE, "name" TEXT NOT NULL, "description" TEXT NOT NULL, "websiteLimit" INTEGER NOT NULL CHECK ("websiteLimit" > 0), "features" TEXT[] DEFAULT ARRAY[]::TEXT[], "active" BOOLEAN NOT NULL DEFAULT true, "position" INTEGER NOT NULL DEFAULT 0, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL);
CREATE TABLE "BillingPrice" ("id" TEXT PRIMARY KEY, "planId" TEXT NOT NULL REFERENCES "BillingPlan"("id"), "stripePriceId" TEXT NOT NULL UNIQUE, "stripeProductId" TEXT NOT NULL, "interval" TEXT NOT NULL CHECK ("interval" IN ('month','year')), "amount" INTEGER NOT NULL CHECK ("amount" > 0), "currency" TEXT NOT NULL, "active" BOOLEAN NOT NULL DEFAULT true, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX "BillingPrice_planId_active_idx" ON "BillingPrice"("planId", "active");
ALTER TABLE "Workspace" ADD COLUMN "billingExempt" BOOLEAN NOT NULL DEFAULT false, ADD COLUMN "billingPlanId" TEXT REFERENCES "BillingPlan"("id"), ADD COLUMN "stripeCustomerId" TEXT UNIQUE, ADD COLUMN "stripeSubscriptionId" TEXT UNIQUE, ADD COLUMN "billingStatus" TEXT NOT NULL DEFAULT 'none', ADD COLUMN "billingPeriodEnd" TIMESTAMP(3), ADD COLUMN "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false, ADD COLUMN "checkoutSessionId" TEXT, ADD COLUMN "checkoutExpiresAt" TIMESTAMP(3);
-- Preserve access for existing workspaces only. New accounts start without a plan.
UPDATE "Workspace" SET "billingExempt" = true;
CREATE TABLE "BillingEvent" ("id" TEXT PRIMARY KEY, "type" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE "AuthRateLimit" ("key" TEXT PRIMARY KEY, "count" INTEGER NOT NULL DEFAULT 1, "expiresAt" TIMESTAMP(3) NOT NULL);
CREATE INDEX "AuthRateLimit_expiresAt_idx" ON "AuthRateLimit"("expiresAt");
CREATE TABLE "WorkspaceInvitation" ("id" TEXT PRIMARY KEY, "workspaceId" TEXT NOT NULL REFERENCES "Workspace"("id") ON DELETE CASCADE, "email" TEXT NOT NULL, "role" "WorkspaceRole" NOT NULL DEFAULT 'EDITOR', "tokenHash" TEXT NOT NULL UNIQUE, "expiresAt" TIMESTAMP(3) NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE UNIQUE INDEX "WorkspaceInvitation_workspaceId_email_key" ON "WorkspaceInvitation"("workspaceId", "email");
INSERT INTO "BillingPlan" ("id", "slug", "name", "description", "websiteLimit", "features", "position", "updatedAt") VALUES
('plan_solo','solo','Solo','One business. One beautiful website.',1,ARRAY['AI website generation','Visual editor and blog','Custom domain and analytics'],0,CURRENT_TIMESTAMP),
('plan_studio','studio','Studio','Room for your growing portfolio.',5,ARRAY['Everything in Solo','Five websites','Team collaboration'],1,CURRENT_TIMESTAMP),
('plan_business','business','Business','Build and manage more brands.',10,ARRAY['Everything in Studio','Ten websites','Central workspace management'],2,CURRENT_TIMESTAMP),
('plan_agency','agency','Agency','For agencies managing 25 or more websites.',25,ARRAY['Everything in Business','25 websites to start','Configurable capacity'],3,CURRENT_TIMESTAMP);
