ALTER TABLE "Workspace" ADD COLUMN "billingWebsiteQuantity" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Workspace" ADD CONSTRAINT "Workspace_billingWebsiteQuantity_positive" CHECK ("billingWebsiteQuantity" >= 1);
