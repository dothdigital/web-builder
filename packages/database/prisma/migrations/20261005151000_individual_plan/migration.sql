-- Keep plan IDs and existing subscription mappings; expose one offer for new purchases.
UPDATE "BillingPlan" SET "slug" = 'individual', "name" = 'Individual', "description" = 'Your own business website for US$29 per month.', "active" = true, "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = 'plan_solo';
UPDATE "BillingPlan" SET "active" = false, "updatedAt" = CURRENT_TIMESTAMP WHERE "slug" <> 'individual';
