-- Новая коллекция скинов: разные персонажи вместо перекрасок одного кота.
-- Купленные скины прошлой коллекции заменяются персонажами той же ценности (тот же источник и дата),
-- надетый старый скин сбрасывается на новый стартовый. Баланс, прогресс, карточки и друзья не меняются.

CREATE TEMP TABLE "_legacy_skin" ("old" TEXT PRIMARY KEY, "new" TEXT NOT NULL);
INSERT INTO "_legacy_skin" ("old", "new") VALUES
  ('pink_angel', 'desert_nomad'),
  ('cyber', 'sakura_blossom'),
  ('crypto_king', 'astro_cat'),
  ('samurai', 'mecha'),
  ('neon_tokyo', 'crystal_prince'),
  ('shadow', 'forest_spirit'),
  ('galaxy', 'ocean_guardian'),
  ('golden_boss', 'stealth_assassin'),
  ('hacker', 'dark_reaper'),
  ('diamond', 'angel_guardian'),
  ('queen', 'shadow_drifter'),
  ('legendary_crown', 'galaxy_emperor');

INSERT INTO "UserCosmetic" ("userId", "cosmeticId", "source", "acquiredAt")
SELECT uc."userId", l."new", uc."source", uc."acquiredAt"
FROM "UserCosmetic" uc
JOIN "_legacy_skin" l ON l."old" = uc."cosmeticId"
ON CONFLICT ("userId", "cosmeticId") DO NOTHING;

DELETE FROM "UserCosmetic" WHERE "cosmeticId" IN (SELECT "old" FROM "_legacy_skin") OR "cosmeticId" = 'black_crown';

UPDATE "User" SET "equippedSkinId" = 'neon_punk'
WHERE "equippedSkinId" NOT IN ('neon_punk', 'desert_nomad', 'sakura_blossom', 'astro_cat', 'mecha', 'crystal_prince', 'forest_spirit', 'ocean_guardian', 'inferno', 'toxic', 'stealth_assassin', 'dark_reaper', 'arctic_king', 'vampire_lord', 'lunar_witch', 'royal_emperor', 'angel_guardian', 'shadow_drifter', 'cyber_samurai', 'galaxy_emperor');

ALTER TABLE "User" ALTER COLUMN "equippedSkinId" SET DEFAULT 'neon_punk';

DROP TABLE "_legacy_skin";
