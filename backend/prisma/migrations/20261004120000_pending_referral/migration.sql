-- CreateTable
CREATE TABLE "PendingReferral" (
    "telegramId" BIGINT NOT NULL,
    "inviterTelegramId" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PendingReferral_pkey" PRIMARY KEY ("telegramId")
);

