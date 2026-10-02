-- AlterTable
ALTER TABLE "User" ADD COLUMN     "achievementIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "newAchievementIds" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "DeletedUser" (
    "telegramId" BIGINT NOT NULL,
    "deletedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeletedUser_pkey" PRIMARY KEY ("telegramId")
);
