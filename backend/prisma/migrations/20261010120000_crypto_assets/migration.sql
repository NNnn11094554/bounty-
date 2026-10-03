-- Крипто-активы вместо карточек: новые категории, редкость и цена открытия в Telegram Stars.
-- Старые карточки (рынки, PR, юристы) сервер при старте удаляет сам, вернув игрокам потраченные монеты
-- (services/cards.ts → retireLegacyCards).
ALTER TYPE "CardCategory" RENAME VALUE 'MARKETS' TO 'LAYER1';
ALTER TYPE "CardCategory" RENAME VALUE 'PR_TEAM' TO 'DEFI';
ALTER TYPE "CardCategory" RENAME VALUE 'LEGAL' TO 'MEME';

ALTER TABLE "Card" ADD COLUMN "rarity" TEXT NOT NULL DEFAULT 'common';
ALTER TABLE "Card" ADD COLUMN "starsPrice" INTEGER;
