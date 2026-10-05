UPDATE "Workspace" w SET "billingExempt" = true, "billingExemptionReason" = 'staff'
WHERE w."billingExempt" = false AND EXISTS (SELECT 1 FROM "WorkspaceMember" m JOIN "User" u ON u."id" = m."userId" WHERE m."workspaceId" = w."id" AND m."role" = 'OWNER' AND (u."isPlatformAdmin" = true OR u."isPlatformSupport" = true) AND u."suspendedAt" IS NULL);
UPDATE "EmailSequenceStep" SET "enabled" = false WHERE "subject" ILIKE '%trial%' OR "body" ILIKE '%trial%';
