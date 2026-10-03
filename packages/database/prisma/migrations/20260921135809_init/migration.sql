-- CreateEnum
CREATE TYPE "WorkspaceRole" AS ENUM ('OWNER', 'EDITOR', 'VIEWER');

-- CreateEnum
CREATE TYPE "WorkspaceStatus" AS ENUM ('ACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('DRAFT', 'GENERATING', 'READY', 'PUBLISHED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "PageType" AS ENUM ('HOME', 'ABOUT', 'SERVICE', 'SERVICE_CATEGORY', 'LOCATION', 'CONTACT', 'BOOKING', 'FAQ', 'TEAM', 'GALLERY', 'PRICING', 'BLOG_INDEX', 'BLOG_ARTICLE', 'LANDING', 'LEGAL', 'CUSTOM');

-- CreateEnum
CREATE TYPE "PageStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "WebsiteVersionKind" AS ENUM ('DRAFT', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "ComponentFamily" AS ENUM ('HEADER', 'HERO', 'SERVICES', 'ABOUT', 'GALLERY', 'REVIEWS', 'TEAM', 'PRICING', 'FAQ', 'CONTACT', 'CTA', 'FOOTER');

-- CreateEnum
CREATE TYPE "AssetKind" AS ENUM ('IMAGE', 'VIDEO', 'DOCUMENT', 'LOGO');

-- CreateEnum
CREATE TYPE "AssetSource" AS ENUM ('UPLOAD', 'AI_GENERATED', 'PLACEHOLDER');

-- CreateEnum
CREATE TYPE "CollectionType" AS ENUM ('SERVICES', 'TEAM', 'TESTIMONIALS', 'FAQS', 'LOCATIONS', 'SOCIAL', 'BLOG_POSTS');

-- CreateEnum
CREATE TYPE "MenuLinkType" AS ENUM ('PAGE', 'URL', 'ANCHOR', 'EMAIL', 'PHONE', 'ACTION');

-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('NEW', 'READ', 'ARCHIVED', 'SPAM');

-- CreateEnum
CREATE TYPE "GenerationStage" AS ENUM ('ANALYZE_BRIEF', 'NEXT_QUESTIONS', 'DESIGN_DIRECTIONS', 'DESIGN_DNA', 'SITE_PLAN', 'CONTENT', 'COMPOSE', 'IMAGES', 'VALIDATE', 'AI_EDIT');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DomainStatus" AS ENUM ('PENDING', 'VERIFYING', 'ACTIVE', 'FAILED');

-- CreateEnum
CREATE TYPE "ReleaseStatus" AS ENUM ('PENDING', 'VALIDATING', 'DEPLOYING', 'LIVE', 'FAILED', 'ROLLED_BACK');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "image" TEXT,
    "emailVerified" TIMESTAMP(3),
    "isPlatformAdmin" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "Workspace" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "plan" TEXT NOT NULL DEFAULT 'free',
    "status" "WorkspaceStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Workspace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkspaceMember" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "WorkspaceRole" NOT NULL DEFAULT 'EDITOR',
    "canPublish" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkspaceMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "defaultLocale" TEXT NOT NULL DEFAULT 'en',
    "status" "ProjectStatus" NOT NULL DEFAULT 'DRAFT',
    "previewHost" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BusinessProfile" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "legalName" TEXT,
    "displayName" TEXT NOT NULL,
    "tagline" TEXT,
    "industry" TEXT,
    "description" TEXT,
    "audience" TEXT,
    "tone" TEXT,
    "primaryDomain" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "whatsapp" TEXT,
    "addressLine1" TEXT,
    "addressLine2" TEXT,
    "city" TEXT,
    "region" TEXT,
    "postalCode" TEXT,
    "country" TEXT,
    "serviceArea" TEXT[],
    "hours" JSONB,
    "primaryConversion" TEXT,
    "bookingUrl" TEXT,
    "missingFacts" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusinessProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrandProfile" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "logoAssetId" TEXT,
    "colorDirection" TEXT,
    "typographyFeel" TEXT,
    "preferredColors" TEXT[],
    "avoidedColors" TEXT[],
    "styleAdjectives" TEXT[],
    "letAiChoose" BOOLEAN NOT NULL DEFAULT true,
    "designDna" JSONB,
    "tokens" JSONB,
    "fingerprint" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrandProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Page" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "parentId" TEXT,
    "title" TEXT NOT NULL,
    "navLabel" TEXT,
    "slug" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "pageType" "PageType" NOT NULL DEFAULT 'CUSTOM',
    "status" "PageStatus" NOT NULL DEFAULT 'DRAFT',
    "locale" TEXT NOT NULL DEFAULT 'en',
    "position" INTEGER NOT NULL DEFAULT 0,
    "showInNav" BOOLEAN NOT NULL DEFAULT true,
    "indexable" BOOLEAN NOT NULL DEFAULT true,
    "canonicalUrl" TEXT,
    "seoTitle" TEXT,
    "seoDescription" TEXT,
    "ogImageAssetId" TEXT,
    "sections" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Page_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebsiteVersion" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "kind" "WebsiteVersionKind" NOT NULL DEFAULT 'DRAFT',
    "model" JSONB NOT NULL,
    "schemaVersion" TEXT NOT NULL,
    "createdById" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebsiteVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComponentDefinition" (
    "id" TEXT NOT NULL,
    "componentId" TEXT NOT NULL,
    "family" "ComponentFamily" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "aiGuidance" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ComponentDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComponentVersion" (
    "id" TEXT NOT NULL,
    "definitionId" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "propsSchema" JSONB NOT NULL,
    "editorFields" JSONB NOT NULL,
    "tokenDeps" TEXT[],
    "deprecated" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ComponentVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Asset" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "projectId" TEXT,
    "kind" "AssetKind" NOT NULL DEFAULT 'IMAGE',
    "source" "AssetSource" NOT NULL DEFAULT 'UPLOAD',
    "storageKey" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "bytes" INTEGER,
    "altText" TEXT,
    "focalPoint" JSONB,
    "prompt" TEXT,
    "replacesId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Collection" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "type" "CollectionType" NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Collection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CollectionItem" (
    "id" TEXT NOT NULL,
    "collectionId" TEXT NOT NULL,
    "slug" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "published" BOOLEAN NOT NULL DEFAULT true,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CollectionItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Menu" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Menu_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MenuItem" (
    "id" TEXT NOT NULL,
    "menuId" TEXT NOT NULL,
    "parentId" TEXT,
    "label" TEXT NOT NULL,
    "linkType" "MenuLinkType" NOT NULL DEFAULT 'PAGE',
    "pageId" TEXT,
    "url" TEXT,
    "anchor" TEXT,
    "icon" TEXT,
    "newTab" BOOLEAN NOT NULL DEFAULT false,
    "rel" TEXT,
    "visible" BOOLEAN NOT NULL DEFAULT true,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "MenuItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SocialLink" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "network" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "label" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "SocialLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Integration" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "ga4MeasurementId" TEXT,
    "gtmContainerId" TEXT,
    "googleVerification" TEXT,
    "bingVerification" TEXT,
    "consentMode" TEXT NOT NULL DEFAULT 'disabled',
    "conversionEvents" TEXT[],
    "customEvents" JSONB,
    "disableInPreview" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Integration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Redirect" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "fromPath" TEXT NOT NULL,
    "toPath" TEXT NOT NULL,
    "statusCode" INTEGER NOT NULL DEFAULT 301,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Redirect_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "pagePath" TEXT,
    "formKey" TEXT,
    "payload" JSONB NOT NULL,
    "utm" JSONB,
    "ipHash" TEXT,
    "userAgent" TEXT,
    "status" "LeadStatus" NOT NULL DEFAULT 'NEW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiConversation" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "purpose" TEXT NOT NULL DEFAULT 'onboarding',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "data" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GenerationJob" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "stage" "GenerationStage" NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'QUEUED',
    "correlationId" TEXT NOT NULL,
    "provider" TEXT,
    "model" TEXT,
    "promptVersion" TEXT,
    "input" JSONB,
    "output" JSONB,
    "errorMessage" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "inputTokens" INTEGER,
    "outputTokens" INTEGER,
    "costCents" INTEGER,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GenerationJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PromptVersion" (
    "id" TEXT NOT NULL,
    "stage" "GenerationStage" NOT NULL,
    "version" TEXT NOT NULL,
    "template" TEXT NOT NULL,
    "outputSchema" JSONB,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PromptVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Domain" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "hostname" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "wwwPreference" TEXT NOT NULL DEFAULT 'non-www',
    "status" "DomainStatus" NOT NULL DEFAULT 'PENDING',
    "verificationToken" TEXT,
    "sslStatus" TEXT NOT NULL DEFAULT 'pending',
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Domain_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PublishRelease" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "websiteVersionId" TEXT NOT NULL,
    "releaseNumber" INTEGER NOT NULL,
    "status" "ReleaseStatus" NOT NULL DEFAULT 'PENDING',
    "snapshot" JSONB NOT NULL,
    "sitemapXml" TEXT,
    "robotsTxt" TEXT,
    "llmsTxt" TEXT,
    "validation" JSONB,
    "rolledBackFromId" TEXT,
    "publishedById" TEXT,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PublishRelease_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT,
    "projectId" TEXT,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "targetType" TEXT,
    "targetId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UsageRecord" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "projectId" TEXT,
    "kind" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "costCents" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UsageRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeatureFlag" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "workspaceId" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "plan" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeatureFlag_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Account_userId_idx" ON "Account"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "Workspace_slug_key" ON "Workspace"("slug");

-- CreateIndex
CREATE INDEX "WorkspaceMember_userId_idx" ON "WorkspaceMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkspaceMember_workspaceId_userId_key" ON "WorkspaceMember"("workspaceId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "Project_previewHost_key" ON "Project"("previewHost");

-- CreateIndex
CREATE INDEX "Project_workspaceId_idx" ON "Project"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "Project_workspaceId_slug_key" ON "Project"("workspaceId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "BusinessProfile_projectId_key" ON "BusinessProfile"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "BrandProfile_projectId_key" ON "BrandProfile"("projectId");

-- CreateIndex
CREATE INDEX "Page_projectId_idx" ON "Page"("projectId");

-- CreateIndex
CREATE INDEX "Page_parentId_idx" ON "Page"("parentId");

-- CreateIndex
CREATE UNIQUE INDEX "Page_projectId_locale_path_key" ON "Page"("projectId", "locale", "path");

-- CreateIndex
CREATE INDEX "WebsiteVersion_projectId_kind_idx" ON "WebsiteVersion"("projectId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "WebsiteVersion_projectId_version_key" ON "WebsiteVersion"("projectId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "ComponentDefinition_componentId_key" ON "ComponentDefinition"("componentId");

-- CreateIndex
CREATE UNIQUE INDEX "ComponentVersion_definitionId_version_key" ON "ComponentVersion"("definitionId", "version");

-- CreateIndex
CREATE INDEX "Asset_workspaceId_idx" ON "Asset"("workspaceId");

-- CreateIndex
CREATE INDEX "Asset_projectId_idx" ON "Asset"("projectId");

-- CreateIndex
CREATE INDEX "Collection_projectId_idx" ON "Collection"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "Collection_projectId_type_key" ON "Collection"("projectId", "type");

-- CreateIndex
CREATE INDEX "CollectionItem_collectionId_idx" ON "CollectionItem"("collectionId");

-- CreateIndex
CREATE UNIQUE INDEX "Menu_projectId_key_key" ON "Menu"("projectId", "key");

-- CreateIndex
CREATE INDEX "MenuItem_menuId_idx" ON "MenuItem"("menuId");

-- CreateIndex
CREATE INDEX "MenuItem_parentId_idx" ON "MenuItem"("parentId");

-- CreateIndex
CREATE UNIQUE INDEX "SocialLink_projectId_network_key" ON "SocialLink"("projectId", "network");

-- CreateIndex
CREATE UNIQUE INDEX "Integration_projectId_key" ON "Integration"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "Redirect_projectId_fromPath_key" ON "Redirect"("projectId", "fromPath");

-- CreateIndex
CREATE INDEX "Lead_projectId_createdAt_idx" ON "Lead"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "AiConversation_projectId_idx" ON "AiConversation"("projectId");

-- CreateIndex
CREATE INDEX "AiMessage_conversationId_idx" ON "AiMessage"("conversationId");

-- CreateIndex
CREATE INDEX "GenerationJob_projectId_stage_idx" ON "GenerationJob"("projectId", "stage");

-- CreateIndex
CREATE INDEX "GenerationJob_correlationId_idx" ON "GenerationJob"("correlationId");

-- CreateIndex
CREATE UNIQUE INDEX "PromptVersion_stage_version_key" ON "PromptVersion"("stage", "version");

-- CreateIndex
CREATE UNIQUE INDEX "Domain_hostname_key" ON "Domain"("hostname");

-- CreateIndex
CREATE INDEX "Domain_projectId_idx" ON "Domain"("projectId");

-- CreateIndex
CREATE INDEX "PublishRelease_projectId_status_idx" ON "PublishRelease"("projectId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "PublishRelease_projectId_releaseNumber_key" ON "PublishRelease"("projectId", "releaseNumber");

-- CreateIndex
CREATE INDEX "AuditEvent_workspaceId_createdAt_idx" ON "AuditEvent"("workspaceId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditEvent_projectId_createdAt_idx" ON "AuditEvent"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "UsageRecord_workspaceId_occurredAt_idx" ON "UsageRecord"("workspaceId", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "FeatureFlag_key_workspaceId_key" ON "FeatureFlag"("key", "workspaceId");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceMember" ADD CONSTRAINT "WorkspaceMember_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceMember" ADD CONSTRAINT "WorkspaceMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessProfile" ADD CONSTRAINT "BusinessProfile_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandProfile" ADD CONSTRAINT "BrandProfile_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandProfile" ADD CONSTRAINT "BrandProfile_logoAssetId_fkey" FOREIGN KEY ("logoAssetId") REFERENCES "Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Page" ADD CONSTRAINT "Page_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Page" ADD CONSTRAINT "Page_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Page"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Page" ADD CONSTRAINT "Page_ogImageAssetId_fkey" FOREIGN KEY ("ogImageAssetId") REFERENCES "Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebsiteVersion" ADD CONSTRAINT "WebsiteVersion_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComponentVersion" ADD CONSTRAINT "ComponentVersion_definitionId_fkey" FOREIGN KEY ("definitionId") REFERENCES "ComponentDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_replacesId_fkey" FOREIGN KEY ("replacesId") REFERENCES "Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Collection" ADD CONSTRAINT "Collection_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectionItem" ADD CONSTRAINT "CollectionItem_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Menu" ADD CONSTRAINT "Menu_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MenuItem" ADD CONSTRAINT "MenuItem_menuId_fkey" FOREIGN KEY ("menuId") REFERENCES "Menu"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MenuItem" ADD CONSTRAINT "MenuItem_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "MenuItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocialLink" ADD CONSTRAINT "SocialLink_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Integration" ADD CONSTRAINT "Integration_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Redirect" ADD CONSTRAINT "Redirect_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiConversation" ADD CONSTRAINT "AiConversation_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiMessage" ADD CONSTRAINT "AiMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "AiConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GenerationJob" ADD CONSTRAINT "GenerationJob_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Domain" ADD CONSTRAINT "Domain_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublishRelease" ADD CONSTRAINT "PublishRelease_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublishRelease" ADD CONSTRAINT "PublishRelease_websiteVersionId_fkey" FOREIGN KEY ("websiteVersionId") REFERENCES "WebsiteVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsageRecord" ADD CONSTRAINT "UsageRecord_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsageRecord" ADD CONSTRAINT "UsageRecord_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
