import {
  isShopProductId,
  type InvoiceResponse,
  type PurchaseStatusResponse,
  type ShopResponse,
} from '@meowgul/shared';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/db.js';
import { ApiError } from '../lib/errors.js';
import { requirePlayer } from '../services/player.js';
import { createInvoice, shopProducts } from '../services/shop.js';
import { buildPlayerState } from '../services/state.js';
import { syncPassive } from '../services/sync.js';
import { withUserLock } from '../services/userLock.js';

const InvoiceBody = z.object({ productId: z.string().refine(isShopProductId, 'Unknown product') });
const PurchaseParams = z.object({ id: z.coerce.number().int().positive() });

/** Магазин за Telegram Stars: витрина, счёт, статус оплаты (выдачу делает бот по successful_payment). */
export async function shopRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/shop', async (request): Promise<ShopResponse> => {
    const player = await requirePlayer(request);
    return { products: shopProducts(player) };
  });

  app.post('/api/shop/invoice', async (request): Promise<InvoiceResponse> => {
    const { productId } = InvoiceBody.parse(request.body);
    const player = await requirePlayer(request);
    if (!isShopProductId(productId)) throw new ApiError('VALIDATION', 'Unknown product');
    const { purchase, link } = await createInvoice(player, productId);
    return { purchaseId: purchase.id, link };
  });

  app.get('/api/shop/purchases/:id', async (request): Promise<PurchaseStatusResponse> => {
    const { id } = PurchaseParams.parse(request.params);
    const player = await requirePlayer(request);
    const purchase = await prisma.purchase.findFirst({ where: { id, userId: player.id } });
    if (!purchase) throw new ApiError('NOT_FOUND', 'Purchase not found');
    if (purchase.status !== 'PAID') {
      return { status: purchase.status === 'REFUNDED' ? 'refunded' : 'pending', state: null };
    }
    const now = new Date();
    const { user } = await withUserLock(player.id, (tx, locked) => syncPassive(tx, locked, now));
    return { status: 'paid', state: buildPlayerState(user, now) };
  });
}
