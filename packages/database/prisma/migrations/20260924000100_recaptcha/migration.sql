ALTER TABLE "Integration" ADD COLUMN "recaptchaEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "recaptchaSiteKey" TEXT,
ADD COLUMN "recaptchaSecret" TEXT;
