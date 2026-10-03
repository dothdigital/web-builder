CREATE TABLE "EmailContact" (
 "id" TEXT PRIMARY KEY, "userId" TEXT NOT NULL UNIQUE REFERENCES "User"("id") ON DELETE CASCADE,
 "optedIn" BOOLEAN NOT NULL DEFAULT false, "consentAt" TIMESTAMP(3), "firstLoginAt" TIMESTAMP(3), "convertedAt" TIMESTAMP(3),
 "unsubscribeToken" TEXT NOT NULL UNIQUE, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "EmailContact_optedIn_id_idx" ON "EmailContact"("optedIn", "id");
CREATE TABLE "EmailMarketingSettings" (
 "id" TEXT PRIMARY KEY DEFAULT 'main', "automationEnabled" BOOLEAN NOT NULL DEFAULT false, "deliveryEnabled" BOOLEAN NOT NULL DEFAULT false,
 "senderName" TEXT NOT NULL DEFAULT 'Webtummy', "mailingAddress" TEXT NOT NULL DEFAULT '', "dailyLimit" INTEGER NOT NULL DEFAULT 500 CHECK ("dailyLimit" BETWEEN 1 AND 100000),
 "scanCursor" TEXT, "updatedAt" TIMESTAMP(3) NOT NULL
);
INSERT INTO "EmailMarketingSettings" ("id", "updatedAt") VALUES ('main', CURRENT_TIMESTAMP);
CREATE TABLE "EmailSequenceStep" (
 "id" TEXT PRIMARY KEY, "name" TEXT NOT NULL, "delayDays" INTEGER NOT NULL CHECK ("delayDays" >= 0), "repeatDays" INTEGER NOT NULL DEFAULT 0 CHECK ("repeatDays" = 0 OR "repeatDays" >= 7),
 "websiteCondition" TEXT NOT NULL DEFAULT 'ANY' CHECK ("websiteCondition" IN ('ANY','HAS_WEBSITE','NO_WEBSITE')),
 "subject" TEXT NOT NULL, "body" TEXT NOT NULL, "enabled" BOOLEAN NOT NULL DEFAULT true, "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE TABLE "EmailCampaign" (
 "id" TEXT PRIMARY KEY, "name" TEXT NOT NULL, "audience" TEXT NOT NULL CHECK ("audience" IN ('PAID','UNPAID','TRIAL','EXPIRED')),
 "websiteCondition" TEXT NOT NULL DEFAULT 'ANY' CHECK ("websiteCondition" IN ('ANY','HAS_WEBSITE','NO_WEBSITE')),
 "subject" TEXT NOT NULL, "body" TEXT NOT NULL, "status" TEXT NOT NULL DEFAULT 'DRAFT', "scanCursor" TEXT, "queuedAt" TIMESTAMP(3), "expandedAt" TIMESTAMP(3),
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE INDEX "EmailCampaign_status_createdAt_idx" ON "EmailCampaign"("status", "createdAt");
CREATE TABLE "EmailDelivery" (
 "id" TEXT PRIMARY KEY, "dedupeKey" TEXT NOT NULL UNIQUE, "contactId" TEXT NOT NULL REFERENCES "EmailContact"("id") ON DELETE CASCADE,
 "campaignId" TEXT REFERENCES "EmailCampaign"("id") ON DELETE CASCADE, "stepId" TEXT, "status" TEXT NOT NULL DEFAULT 'PENDING', "attempts" INTEGER NOT NULL DEFAULT 0,
 "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "sentAt" TIMESTAMP(3), "providerMessageId" TEXT, "detail" TEXT,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "EmailDelivery_status_nextAttemptAt_idx" ON "EmailDelivery"("status", "nextAttemptAt");
CREATE INDEX "EmailDelivery_contactId_sentAt_idx" ON "EmailDelivery"("contactId", "sentAt");
CREATE INDEX "EmailDelivery_campaignId_status_idx" ON "EmailDelivery"("campaignId", "status");
INSERT INTO "EmailSequenceStep" ("id","name","delayDays","repeatDays","websiteCondition","subject","body","updatedAt") VALUES
('welcome-no-site','Welcome — start a website',0,0,'NO_WEBSITE','Welcome to Webtummy, {{name}}',E'Hi {{name}},\n\nYour website starts with an idea. Tell us about your business and let Webtummy help you build your first draft.\n\nCreate your website: {{dashboard_url}}\n\nYour trial ends on {{trial_end}}.',CURRENT_TIMESTAMP),
('welcome-site','Welcome — explore your website',0,0,'HAS_WEBSITE','Your next step with {{website_name}}',E'Hi {{name}},\n\nYour website is taking shape. Open your dashboard to review your pages, images and copy.\n\n{{dashboard_url}}',CURRENT_TIMESTAMP),
('day2-no-site','Day 2 — start building',2,0,'NO_WEBSITE','Turn your business idea into a website',E'Hi {{name}},\n\nYou still have time to explore Webtummy. Add your business details and create a website draft, then make it your own in the editor.\n\n{{dashboard_url}}',CURRENT_TIMESTAMP),
('day2-site','Day 2 — make it yours',2,0,'HAS_WEBSITE','Make {{website_name}} feel like your brand',E'Hi {{name}},\n\nTry updating your colours, logo and page content. You can share your temporary preview link while you refine your website.\n\n{{dashboard_url}}',CURRENT_TIMESTAMP),
('day5-no-site','Day 5 — trial reminder',5,0,'NO_WEBSITE','Your Webtummy trial ends on {{trial_end}}',E'Hi {{name}},\n\nThere is still time to try building your first website. Your trial includes the editor and AI tools.\n\nStart here: {{dashboard_url}}',CURRENT_TIMESTAMP),
('day5-site','Day 5 — prepare to launch',5,0,'HAS_WEBSITE','Ready to take {{website_name}} live?',E'Hi {{name}},\n\nReview your pages and contact details, then choose a plan to connect your own domain.\n\nCompare plans: {{billing_url}}\n\nYour trial ends on {{trial_end}}.',CURRENT_TIMESTAMP),
('day7-no-site','After day 7 — weekly invitation',7,7,'NO_WEBSITE','Your next website can start here',E'Hi {{name}},\n\nReady to build your website with Webtummy? Choose a plan when you are ready to continue.\n\n{{billing_url}}',CURRENT_TIMESTAMP),
('day7-site','After day 7 — weekly launch reminder',7,7,'HAS_WEBSITE','Continue working on {{website_name}}',E'Hi {{name}},\n\nYour saved website is waiting for you. Choose a plan to continue editing and connect your live domain.\n\n{{billing_url}}',CURRENT_TIMESTAMP);
