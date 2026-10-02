-- AlterTable
ALTER TABLE "User" ADD COLUMN     "equippedEffectId" TEXT NOT NULL DEFAULT 'coins',
ADD COLUMN     "equippedSkinId" TEXT NOT NULL DEFAULT 'black_crown';

-- CreateTable
CREATE TABLE "UserCosmetic" (
    "userId" INTEGER NOT NULL,
    "cosmeticId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "acquiredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserCosmetic_pkey" PRIMARY KEY ("userId","cosmeticId")
);

-- AddForeignKey
ALTER TABLE "UserCosmetic" ADD CONSTRAINT "UserCosmetic_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

