import type { FastifyInstance, FastifyRequest } from 'fastify';
import { env } from '../env.js';
import { ApiError } from '../lib/errors.js';
import { getAppSettings, versionAtLeast } from '../services/settings.js';
import { InitDataError, validateInitData, type ValidatedInitData } from './initData.js';

declare module 'fastify' {
  interface FastifyRequest {
    tg: ValidatedInitData | null;
  }
  interface FastifyContextConfig {
    /** маршрут не требует initData (health, dev, вебхук бота) */
    public?: boolean;
  }
}

/** Извлечь и проверить initData из заголовка `Authorization: tma <initData>`. */
export function readInitData(request: FastifyRequest): ValidatedInitData {
  const header = request.headers.authorization ?? '';
  const space = header.indexOf(' ');
  const scheme = space > 0 ? header.slice(0, space) : header;
  const value = space > 0 ? header.slice(space + 1).trim() : '';
  if (scheme.toLowerCase() !== 'tma' || !value) {
    throw new ApiError('UNAUTHORIZED', 'Missing Telegram init data');
  }
  try {
    return validateInitData(value, env.BOT_TOKEN);
  } catch (err) {
    if (err instanceof InitDataError) throw new ApiError('UNAUTHORIZED', `Invalid init data: ${err.message}`);
    throw err;
  }
}

export function registerAuthHooks(app: FastifyInstance): void {
  app.decorateRequest('tg', null);
  app.addHook('onRequest', async (request) => {
    if (!request.url.startsWith('/api/') || request.routeOptions.config?.public) return;
    request.tg = readInitData(request);

    const settings = await getAppSettings();
    const version = request.headers['x-client-version'];
    if (typeof version === 'string' && version && !versionAtLeast(version, settings.minClientVersion)) {
      throw new ApiError('OUTDATED_CLIENT', 'Please update the app', {
        minVersion: settings.minClientVersion,
      });
    }
    const isAdmin = env.adminIds.has(BigInt(request.tg.user.id));
    if (settings.maintenance.enabled && !isAdmin) {
      throw new ApiError('MAINTENANCE', settings.maintenance.message || 'Maintenance in progress');
    }
  });
}
