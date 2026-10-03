import { randomUUID } from 'node:crypto';
import {
  cosmeticById,
  SHOP_PRODUCT_IDS,
  type Locale,
  type ShopProduct,
  type ShopProductId,
} from '@meowgul/shared';
import type { Prisma, Purchase, User } from '@prisma/client';
import { GrammyError } from 'grammy';
import { botLocale } from '../bot/texts.js';
import { env } from '../env.js';
import { cardLevelProfit } from '../game/config/cards.js';
import { maxEnergy } from '../game/config/game.js';
import { packCoins, SHOP } from '../game/config/shop.js';
import { prisma } from '../lib/db.js';
import { ApiError } from '../lib/errors.js';
import { logger } from '../lib/logger.js';
import { checkAchievements } from './achievements.js';
import {
  cardLock,
  getCatalog,
  getCatalogCard,
  grantAssetUnlock,
  limitedWindow,
  loadProgress,
  needsStars,
  revokeAssetUnlock,
} from './cards.js';
import { grantCosmetic, ownedCosmetics, revokeCosmetic } from './cosmetics.js';
import { applyBalanceChanges } from './ledger.js';
import { payments } from './payments.js';
import { parseSettings } from './state.js';
import { syncPassive } from './sync.js';
import { withUserLock } from './userLock.js';

/** Что выдаётся за покупку (рассчитано при выставлении счёта и хранится в Purchase.grant). */
type Grant =
  { coins: number } | { energy: true } | { hours: number } | { cosmetic: string } | { asset: string };

/** Покупка актива за Stars: productId = "asset_<id актива>". */
export const ASSET_PRODUCT_PREFIX = 'asset_';

/** Неоплаченный счёт действует сутки. */
const INVOICE_TTL_MS = 24 * 3_600_000;
/** Не больше стольких неоплаченных счетов за 10 минут — защита от спама. */
const MAX_PENDING_PER_10_MIN = 10;

export function shopProducts(
  user: Pick<User, 'profitPerHour'>,
  owned: readonly string[] = [],
): ShopProduct[] {
  const pph = Number(user.profitPerHour);
  const baseRate = packCoins('coins_small', pph) / SHOP.coins_small.stars;
  return SHOP_PRODUCT_IDS.map((id) => {
    const p = SHOP[id];
    const coins = p.kind === 'coins' ? packCoins(id, pph) : null;
    return {
      id,
      kind: p.kind,
      stars: p.stars,
      coins,
      hours: p.kind === 'income_boost' ? (p.hours ?? null) : null,
      bonusPercent:
        coins !== null && id !== 'coins_small' ? Math.round((coins / p.stars / baseRate - 1) * 100) : null,
      popular: p.popular ?? false,
      cosmeticId: p.cosmeticId ?? null,
      owned: p.cosmeticId ? owned.includes(p.cosmeticId) : false,
    };
  });
}

function grantFor(id: ShopProductId, user: User): Grant {
  const p = SHOP[id];
  if (p.kind === 'coins') return { coins: packCoins(id, Number(user.profitPerHour)) };
  if (p.kind === 'energy') return { energy: true };
  if (p.kind === 'cosmetic') return { cosmetic: p.cosmeticId! };
  return { hours: p.hours ?? 24 };
}

const fmt = (n: number, locale: Locale) =>
  new Intl.NumberFormat(locale === 'ru' ? 'ru-RU' : 'en-US').format(n);

/** Счёт за предмет коллекции: название и описание из каталога. */
function cosmeticText(id: string): Record<Locale, () => [string, string]> {
  const item = cosmeticById(id)!;
  return { ru: () => [item.name.ru, item.desc.ru], en: () => [item.name.en, item.desc.en] };
}

const INVOICE_TEXT: Record<ShopProductId, Record<Locale, (g: Grant) => [string, string]>> = {
  coins_small: {
    ru: (g) => ['Горсть монет', `+${fmt('coins' in g ? g.coins : 0, 'ru')} монет на баланс в Meowgul`],
    en: (g) => [
      'Handful of coins',
      `+${fmt('coins' in g ? g.coins : 0, 'en')} coins to your Meowgul balance`,
    ],
  },
  coins_medium: {
    ru: (g) => ['Мешок монет', `+${fmt('coins' in g ? g.coins : 0, 'ru')} монет на баланс в Meowgul`],
    en: (g) => ['Bag of coins', `+${fmt('coins' in g ? g.coins : 0, 'en')} coins to your Meowgul balance`],
  },
  coins_large: {
    ru: (g) => ['Сейф монет', `+${fmt('coins' in g ? g.coins : 0, 'ru')} монет на баланс в Meowgul`],
    en: (g) => ['Vault of coins', `+${fmt('coins' in g ? g.coins : 0, 'en')} coins to your Meowgul balance`],
  },
  energy_refill: {
    ru: () => ['Полная энергия', 'Энергия кота сразу на максимум — тапай дальше без ожидания'],
    en: () => ['Full energy', 'Refill the cat’s energy instantly and keep tapping'],
  },
  income_x2: {
    ru: (g) => [
      'Доход ×2',
      `Пассивный доход карточек удваивается на ${'hours' in g ? g.hours : 24} ч. Если буст уже идёт — время добавится`,
    ],
    en: (g) => [
      'Income ×2',
      `Your cards’ passive income doubles for ${'hours' in g ? g.hours : 24} h. Stacks with an active boost`,
    ],
  },
  skin_angel_guardian: cosmeticText('angel_guardian'),
  skin_shadow_drifter: cosmeticText('shadow_drifter'),
  skin_cyber_samurai: cosmeticText('cyber_samurai'),
  skin_galaxy_emperor: cosmeticText('galaxy_emperor'),
  skin_forest_spirit: cosmeticText('forest_spirit'),
  skin_ocean_guardian: cosmeticText('ocean_guardian'),
  skin_inferno: cosmeticText('inferno'),
  skin_toxic: cosmeticText('toxic'),
  skin_stealth_assassin: cosmeticText('stealth_assassin'),
  skin_dark_reaper: cosmeticText('dark_reaper'),
  skin_arctic_king: cosmeticText('arctic_king'),
  skin_vampire_lord: cosmeticText('vampire_lord'),
  skin_lunar_witch: cosmeticText('lunar_witch'),
  skin_royal_emperor: cosmeticText('royal_emperor'),
  effect_matrix: cosmeticText('matrix'),
};

function playerLocale(user: User): Locale {
  return parseSettings(user.settings).language ?? botLocale(user.languageCode);
}

interface InvoiceItem {
  productId: string;
  stars: number;
  grant: Grant;
  title: string;
  description: string;
}

/** Выставить счёт: запись покупки (PENDING) и ссылка для Telegram.WebApp.openInvoice. */
async function issueInvoice(user: User, item: InvoiceItem): Promise<{ purchase: Purchase; link: string }> {
  const recent = await prisma.purchase.count({
    where: { userId: user.id, status: 'PENDING', createdAt: { gt: new Date(Date.now() - 10 * 60_000) } },
  });
  if (recent >= MAX_PENDING_PER_10_MIN) throw new ApiError('RATE_LIMITED', 'Too many unpaid invoices');
  const purchase = await prisma.purchase.create({
    data: {
      userId: user.id,
      productId: item.productId,
      stars: item.stars,
      payload: randomUUID(),
      grant: item.grant as Prisma.InputJsonValue,
    },
  });
  try {
    const link = await payments().createInvoiceLink({
      // ограничения Telegram: название до 32 символов, описание до 255
      title: item.title.slice(0, 32),
      description: item.description.slice(0, 255),
      payload: purchase.payload,
      stars: purchase.stars,
      photoUrl: `${env.WEBAPP_URL.replace(/\/$/, '')}/assets/generated/og-image.jpg`,
    });
    return { purchase, link };
  } catch (err) {
    logger.error({ err, productId: item.productId }, 'createInvoiceLink failed');
    await prisma.purchase.delete({ where: { id: purchase.id } });
    throw new ApiError('UNAVAILABLE', 'Payments are unavailable, try later');
  }
}

/** Счёт за товар магазина. */
export async function createInvoice(
  user: User,
  productId: ShopProductId,
): Promise<{ purchase: Purchase; link: string }> {
  const cosmeticId = SHOP[productId].cosmeticId;
  if (cosmeticId && (await ownedCosmetics(prisma, user)).includes(cosmeticId)) {
    throw new ApiError('CONFLICT', 'Already owned');
  }
  const grant = grantFor(productId, user);
  const [title, description] = INVOICE_TEXT[productId][playerLocale(user)](grant);
  return issueInvoice(user, { productId, stars: SHOP[productId].stars, grant, title, description });
}

/**
 * Счёт за открытие актива в Stars: актив в продаже (у лимитированного идёт окно), ещё не куплен,
 * открывается именно за Stars и его условия выполнены.
 */
export async function createAssetInvoice(
  user: User,
  cardId: string,
): Promise<{ purchase: Purchase; link: string }> {
  const card = await getCatalogCard(cardId);
  if (!card || !card.isActive) throw new ApiError('NOT_FOUND', 'Card not found');
  const [catalog, progress] = await Promise.all([getCatalog(), loadProgress(prisma, user)]);
  if ((progress.levels.get(card.id) ?? 0) > 0) throw new ApiError('CONFLICT', 'Already owned');
  if (!needsStars(card, progress)) throw new ApiError('CONFLICT', 'This asset is unlocked with coins');
  if (card.isLimited) {
    const window = limitedWindow(card, catalog, new Date());
    if (!window.active) {
      throw new ApiError('LOCKED', 'Card is not available now', {
        reason: 'limited',
        nextFrom: window.nextFrom?.getTime() ?? null,
      });
    }
  }
  const lock = cardLock(card, progress, new Map(catalog.map((c) => [c.id, c])));
  if (lock) throw new ApiError('LOCKED', 'Card is locked', { reason: 'condition', lock });
  const locale = playerLocale(user);
  const profit = fmt(cardLevelProfit(card, 1), locale);
  const [title, description] =
    locale === 'ru'
      ? [
          `Актив ${card.nameRu}`,
          `Открыть игровой актив ${card.nameRu} в Meowgul: 1-й уровень и +${profit} монет к доходу в час. ` +
            'Дальше он прокачивается за монеты. Это игровой предмет, а не криптовалюта.',
        ]
      : [
          `Asset ${card.nameEn}`,
          `Unlock the ${card.nameEn} game asset in Meowgul: level 1 and +${profit} coins per hour. ` +
            'Further levels are bought with coins. This is a game item, not a cryptocurrency.',
        ];
  return issueInvoice(user, {
    productId: `${ASSET_PRODUCT_PREFIX}${card.id}`,
    stars: card.starsPrice!,
    grant: { asset: card.id },
    title,
    description,
  });
}

export interface PaymentInfo {
  payload: string;
  fromId: number;
  currency: string;
  totalAmount: number;
}

/**
 * pre_checkout_query: Telegram спрашивает, можно ли принять оплату (ответ — за 10 секунд).
 * Возвращает null, если можно, или текст ошибки для покупателя.
 */
export async function checkPreCheckout(p: PaymentInfo): Promise<string | null> {
  const purchase = await prisma.purchase.findUnique({
    where: { payload: p.payload },
    include: { user: true },
  });
  const ru = purchase ? playerLocale(purchase.user) === 'ru' : true;
  const stale = ru
    ? 'Счёт устарел — откройте магазин в игре заново'
    : 'This invoice is out of date — reopen the shop';
  if (!purchase || purchase.status !== 'PENDING') return stale;
  if (Date.now() - purchase.createdAt.getTime() > INVOICE_TTL_MS) return stale;
  if (purchase.user.telegramId !== BigInt(p.fromId)) return stale;
  if (p.currency !== 'XTR' || p.totalAmount !== purchase.stars) return stale;
  if (purchase.user.isBanned) return ru ? 'Аккаунт заблокирован' : 'Your account is banned';
  const grant = purchase.grant as Grant;
  if ('asset' in grant) {
    const owned = await prisma.userCard.findUnique({
      where: { userId_cardId: { userId: purchase.userId, cardId: grant.asset } },
    });
    if (owned && owned.level > 0) return ru ? 'Этот актив уже открыт' : 'You already own this asset';
  }
  return null;
}

/**
 * successful_payment: выдать покупку. Повтор того же платежа (Telegram может прислать обновление ещё раз)
 * ничего не выдаёт второй раз.
 */
export async function fulfillPayment(
  p: PaymentInfo & { chargeId: string },
): Promise<'paid' | 'duplicate' | 'unknown'> {
  const found = await prisma.purchase.findUnique({ where: { payload: p.payload } });
  if (!found) {
    // деньги пришли, а покупки нет — разбирать вручную (/paysupport, возврат через админку)
    logger.error(
      { payload: p.payload, chargeId: p.chargeId, fromId: p.fromId },
      'payment for unknown purchase',
    );
    return 'unknown';
  }
  return withUserLock(
    found.userId,
    async (tx, locked) => {
      const purchase = await tx.purchase.findUniqueOrThrow({ where: { id: found.id } });
      if (purchase.status !== 'PENDING') return 'duplicate';
      const now = new Date();
      // сначала доход по старым условиям, потом выдача (буст дохода действует с момента покупки)
      const { user } = await syncPassive(tx, locked, now);
      const grant = purchase.grant as Grant;
      if ('coins' in grant) {
        await applyBalanceChanges(
          tx,
          user,
          [
            {
              type: 'shop_purchase',
              amount: grant.coins,
              earned: false,
              meta: { purchaseId: purchase.id, productId: purchase.productId, stars: purchase.stars },
            },
          ],
          {},
          now,
        );
      } else if ('energy' in grant) {
        await tx.user.update({
          where: { id: user.id },
          data: { energy: maxEnergy(user.energyLimitLevel), energyUpdatedAt: now },
        });
      } else if ('cosmetic' in grant) {
        // премиальный скин или эффект — в коллекцию и сразу надеть
        await grantCosmetic(tx, user, grant.cosmetic, 'stars');
      } else if ('asset' in grant) {
        // актив за Stars: 1-й уровень и его доход; дальше — прокачка за монеты
        const updated = await grantAssetUnlock(tx, user, grant.asset, now);
        if (updated) await checkAchievements(tx, updated, now, ['cards']);
        // уже был открыт (оплата второго счёта) или снят из каталога — разбирать вручную (возврат в админке)
        else
          logger.error({ userId: user.id, asset: grant.asset, purchaseId: purchase.id }, 'asset not granted');
      } else {
        const from = user.incomeBoostUntil && user.incomeBoostUntil > now ? user.incomeBoostUntil : now;
        await tx.user.update({
          where: { id: user.id },
          data: { incomeBoostUntil: new Date(from.getTime() + grant.hours * 3_600_000) },
        });
      }
      await tx.purchase.update({
        where: { id: purchase.id },
        data: { status: 'PAID', chargeId: p.chargeId, paidAt: now },
      });
      logger.info({ userId: user.id, productId: purchase.productId, stars: purchase.stars }, 'purchase paid');
      return 'paid' as const;
    },
    { allowBanned: true },
  );
}

/**
 * Возврат звёзд (админка): Telegram возвращает оплату, у игрока забирается выданное — монеты (сколько есть
 * на балансе), время буста, предмет коллекции или актив (монеты за его уровни со 2-го возвращаются).
 */
export async function refundPurchase(purchaseId: number): Promise<Purchase> {
  const purchase = await prisma.purchase.findUnique({ where: { id: purchaseId }, include: { user: true } });
  if (!purchase) throw new ApiError('NOT_FOUND', 'Purchase not found');
  if (purchase.status !== 'PAID' || !purchase.chargeId)
    throw new ApiError('CONFLICT', 'Purchase is not paid');
  try {
    await payments().refund(Number(purchase.user.telegramId), purchase.chargeId);
  } catch (err) {
    // уже возвращено (например, через поддержку Telegram) — просто отмечаем у себя
    if (!(err instanceof GrammyError && /REFUNDED/i.test(err.description))) {
      logger.error({ err, purchaseId }, 'refundStarPayment failed');
      throw new ApiError('UNAVAILABLE', err instanceof GrammyError ? err.description : 'Refund failed');
    }
  }
  return withUserLock(
    purchase.userId,
    async (tx, locked) => {
      const fresh = await tx.purchase.findUniqueOrThrow({ where: { id: purchaseId } });
      if (fresh.status !== 'PAID') return fresh;
      const now = new Date();
      const { user } = await syncPassive(tx, locked, now);
      const grant = fresh.grant as Grant;
      if ('coins' in grant) {
        const take = Math.min(grant.coins, Math.max(0, user.balance.floor().toNumber()));
        await applyBalanceChanges(
          tx,
          user,
          [{ type: 'shop_refund', amount: -take, meta: { purchaseId, productId: fresh.productId } }],
          {},
          now,
        );
      } else if ('cosmetic' in grant) {
        await revokeCosmetic(tx, user, grant.cosmetic);
      } else if ('asset' in grant) {
        await revokeAssetUnlock(tx, user, grant.asset, now);
      } else if ('hours' in grant && user.incomeBoostUntil) {
        const until = user.incomeBoostUntil.getTime() - grant.hours * 3_600_000;
        await tx.user.update({
          where: { id: user.id },
          data: { incomeBoostUntil: until > now.getTime() ? new Date(until) : null },
        });
      }
      return tx.purchase.update({ where: { id: purchaseId }, data: { status: 'REFUNDED', refundedAt: now } });
    },
    { allowBanned: true },
  );
}
