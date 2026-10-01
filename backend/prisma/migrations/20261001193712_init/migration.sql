-- CreateEnum
CREATE TYPE "CardCategory" AS ENUM ('MARKETS', 'PR_TEAM', 'LEGAL', 'SPECIALS');

-- CreateEnum
CREATE TYPE "TaskType" AS ENUM ('TELEGRAM_CHANNEL', 'LINK', 'VIDEO', 'INVITE_FRIENDS', 'CHOOSE_HQ', 'CONNECT_WALLET');

-- CreateEnum
CREATE TYPE "TaskSection" AS ENUM ('SPECIAL', 'LIST', 'AIRDROP');

-- CreateEnum
CREATE TYPE "UserTaskStatus" AS ENUM ('PENDING', 'CHECKING', 'DONE');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "BroadcastStatus" AS ENUM ('DRAFT', 'RUNNING', 'PAUSED', 'DONE', 'CANCELLED');

-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "telegramId" BIGINT NOT NULL,
    "username" TEXT,
    "firstName" TEXT NOT NULL DEFAULT '',
    "lastName" TEXT,
    "photoUrl" TEXT,
    "languageCode" TEXT NOT NULL DEFAULT 'en',
    "isPremium" BOOLEAN NOT NULL DEFAULT false,
    "allowsWriteToPm" BOOLEAN NOT NULL DEFAULT false,
    "balance" DECIMAL(38,4) NOT NULL DEFAULT 0,
    "totalEarned" DECIMAL(38,4) NOT NULL DEFAULT 0,
    "totalTaps" BIGINT NOT NULL DEFAULT 0,
    "energy" INTEGER NOT NULL DEFAULT 1000,
    "energyUpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "multitapLevel" INTEGER NOT NULL DEFAULT 1,
    "energyLimitLevel" INTEGER NOT NULL DEFAULT 1,
    "profitPerHour" BIGINT NOT NULL DEFAULT 0,
    "lastSyncAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastTapAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastTapSeq" INTEGER NOT NULL DEFAULT 0,
    "leagueLevel" INTEGER NOT NULL DEFAULT 0,
    "hqId" TEXT,
    "referrerId" INTEGER,
    "walletAddress" TEXT,
    "walletConnectedAt" TIMESTAMP(3),
    "dailyRewardDay" INTEGER NOT NULL DEFAULT 0,
    "dailyRewardClaimedAt" TIMESTAMP(3),
    "dailyRewardDayKey" TEXT,
    "bestDailyStreak" INTEGER NOT NULL DEFAULT 0,
    "boostsDayKey" TEXT,
    "fullEnergyUsedToday" INTEGER NOT NULL DEFAULT 0,
    "fullEnergyLastAt" TIMESTAMP(3),
    "turboUsedToday" INTEGER NOT NULL DEFAULT 0,
    "turboUntil" TIMESTAMP(3),
    "suspiciousScore" INTEGER NOT NULL DEFAULT 0,
    "isBanned" BOOLEAN NOT NULL DEFAULT false,
    "banReason" TEXT,
    "onboardingDone" BOOLEAN NOT NULL DEFAULT false,
    "settings" JSONB NOT NULL DEFAULT '{}',
    "tutorialsSeen" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "notifyDayKey" TEXT,
    "notifySentToday" INTEGER NOT NULL DEFAULT 0,
    "energyFullNotify" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Card" (
    "id" TEXT NOT NULL,
    "category" "CardCategory" NOT NULL,
    "nameRu" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "descRu" TEXT NOT NULL,
    "descEn" TEXT NOT NULL,
    "icon" TEXT NOT NULL,
    "baseCost" BIGINT NOT NULL,
    "baseProfit" BIGINT NOT NULL,
    "costMultiplier" DECIMAL(8,4) NOT NULL,
    "profitMultiplier" DECIMAL(8,4) NOT NULL,
    "maxLevel" INTEGER NOT NULL DEFAULT 25,
    "cooldownSec" INTEGER NOT NULL DEFAULT 0,
    "conditionType" TEXT,
    "conditionValue" TEXT,
    "isLimited" BOOLEAN NOT NULL DEFAULT false,
    "availableFrom" TIMESTAMP(3),
    "availableUntil" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Card_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserCard" (
    "userId" INTEGER NOT NULL,
    "cardId" TEXT NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 0,
    "lastUpgradeAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cooldownUntil" TIMESTAMP(3),

    CONSTRAINT "UserCard_pkey" PRIMARY KEY ("userId","cardId")
);

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "type" "TaskType" NOT NULL,
    "section" "TaskSection" NOT NULL DEFAULT 'LIST',
    "titleRu" TEXT NOT NULL,
    "titleEn" TEXT NOT NULL,
    "descRu" TEXT NOT NULL DEFAULT '',
    "descEn" TEXT NOT NULL DEFAULT '',
    "icon" TEXT NOT NULL DEFAULT 'star',
    "imageUrl" TEXT,
    "url" TEXT,
    "channelId" TEXT,
    "requiredCount" INTEGER,
    "reward" BIGINT NOT NULL,
    "checkDelaySec" INTEGER NOT NULL DEFAULT 30,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserTask" (
    "userId" INTEGER NOT NULL,
    "taskId" TEXT NOT NULL,
    "status" "UserTaskStatus" NOT NULL DEFAULT 'PENDING',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "UserTask_pkey" PRIMARY KEY ("userId","taskId")
);

-- CreateTable
CREATE TABLE "Referral" (
    "id" SERIAL NOT NULL,
    "inviterId" INTEGER NOT NULL,
    "inviteeId" INTEGER NOT NULL,
    "isPremium" BOOLEAN NOT NULL DEFAULT false,
    "bonusGiven" BIGINT NOT NULL DEFAULT 0,
    "leagueBonusesGiven" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "inviterEarned" BIGINT NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Referral_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyCombo" (
    "dayKey" TEXT NOT NULL,
    "cardIds" TEXT[],
    "source" TEXT NOT NULL DEFAULT 'auto',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DailyCombo_pkey" PRIMARY KEY ("dayKey")
);

-- CreateTable
CREATE TABLE "UserComboProgress" (
    "userId" INTEGER NOT NULL,
    "dayKey" TEXT NOT NULL,
    "foundCardIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "rewarded" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "UserComboProgress_pkey" PRIMARY KEY ("userId","dayKey")
);

-- CreateTable
CREATE TABLE "DailyCipher" (
    "dayKey" TEXT NOT NULL,
    "word" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'auto',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DailyCipher_pkey" PRIMARY KEY ("dayKey")
);

-- CreateTable
CREATE TABLE "UserCipher" (
    "userId" INTEGER NOT NULL,
    "dayKey" TEXT NOT NULL,
    "solved" BOOLEAN NOT NULL DEFAULT false,
    "attempts" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "UserCipher_pkey" PRIMARY KEY ("userId","dayKey")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" BIGSERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "amount" DECIMAL(38,4) NOT NULL,
    "balanceAfter" DECIMAL(38,4) NOT NULL,
    "bucket" TEXT,
    "count" INTEGER NOT NULL DEFAULT 1,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserAchievement" (
    "userId" INTEGER NOT NULL,
    "achievementId" TEXT NOT NULL,
    "unlockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserAchievement_pkey" PRIMARY KEY ("userId","achievementId")
);

-- CreateTable
CREATE TABLE "UserActivity" (
    "userId" INTEGER NOT NULL,
    "dayKey" TEXT NOT NULL,

    CONSTRAINT "UserActivity_pkey" PRIMARY KEY ("userId","dayKey")
);

-- CreateTable
CREATE TABLE "UserEvent" (
    "id" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "reward" BIGINT NOT NULL,
    "appearsAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "claimedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "status" "NotificationStatus" NOT NULL DEFAULT 'PENDING',
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Broadcast" (
    "id" SERIAL NOT NULL,
    "text" TEXT NOT NULL,
    "imageUrl" TEXT,
    "buttonText" TEXT,
    "buttonUrl" TEXT,
    "status" "BroadcastStatus" NOT NULL DEFAULT 'DRAFT',
    "total" INTEGER NOT NULL DEFAULT 0,
    "sent" INTEGER NOT NULL DEFAULT 0,
    "failed" INTEGER NOT NULL DEFAULT 0,
    "cursor" INTEGER NOT NULL DEFAULT 0,
    "createdBy" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "Broadcast_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppSetting" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppSetting_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_telegramId_key" ON "User"("telegramId");

-- CreateIndex
CREATE UNIQUE INDEX "User_walletAddress_key" ON "User"("walletAddress");

-- CreateIndex
CREATE INDEX "User_leagueLevel_totalEarned_idx" ON "User"("leagueLevel", "totalEarned" DESC);

-- CreateIndex
CREATE INDEX "User_referrerId_idx" ON "User"("referrerId");

-- CreateIndex
CREATE INDEX "User_suspiciousScore_idx" ON "User"("suspiciousScore");

-- CreateIndex
CREATE INDEX "User_createdAt_idx" ON "User"("createdAt");

-- CreateIndex
CREATE INDEX "Card_category_sortOrder_idx" ON "Card"("category", "sortOrder");

-- CreateIndex
CREATE INDEX "UserCard_cardId_idx" ON "UserCard"("cardId");

-- CreateIndex
CREATE UNIQUE INDEX "Referral_inviteeId_key" ON "Referral"("inviteeId");

-- CreateIndex
CREATE INDEX "Referral_inviterId_createdAt_idx" ON "Referral"("inviterId", "createdAt");

-- CreateIndex
CREATE INDEX "Transaction_userId_createdAt_idx" ON "Transaction"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Transaction_type_createdAt_idx" ON "Transaction"("type", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_userId_type_bucket_key" ON "Transaction"("userId", "type", "bucket");

-- CreateIndex
CREATE INDEX "UserActivity_dayKey_idx" ON "UserActivity"("dayKey");

-- CreateIndex
CREATE INDEX "UserEvent_userId_appearsAt_idx" ON "UserEvent"("userId", "appearsAt");

-- CreateIndex
CREATE INDEX "Notification_status_createdAt_idx" ON "Notification"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_referrerId_fkey" FOREIGN KEY ("referrerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserCard" ADD CONSTRAINT "UserCard_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserCard" ADD CONSTRAINT "UserCard_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserTask" ADD CONSTRAINT "UserTask_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserTask" ADD CONSTRAINT "UserTask_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_inviterId_fkey" FOREIGN KEY ("inviterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_inviteeId_fkey" FOREIGN KEY ("inviteeId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserComboProgress" ADD CONSTRAINT "UserComboProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserCipher" ADD CONSTRAINT "UserCipher_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserAchievement" ADD CONSTRAINT "UserAchievement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserActivity" ADD CONSTRAINT "UserActivity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserEvent" ADD CONSTRAINT "UserEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
