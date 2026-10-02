import type { Prisma } from '@prisma/client';
import { env } from '../env.js';
import { prisma } from '../lib/db.js';

export interface MaintenanceSetting {
  enabled: boolean;
  message: string;
}

/** «Счастливый час»: автоматический раз в игровой день и/или назначенный админом. */
export interface HappyHourSetting {
  /** автоматический счастливый час каждый день */
  auto: boolean;
  /** назначенный админом (ISO-время); действует вместе с автоматическим */
  override: { startsAt: string; endsAt: string; multiplier: number } | null;
}

export interface AppSettings {
  maintenance: MaintenanceSetting;
  minClientVersion: string;
  happyHour: HappyHourSetting;
  /** золотая монета во время тапов */
  goldenCoin: { enabled: boolean };
}

const DEFAULTS: AppSettings = {
  maintenance: { enabled: false, message: '' },
  minClientVersion: env.MIN_CLIENT_VERSION,
  happyHour: { auto: true, override: null },
  goldenCoin: { enabled: true },
};

function parseHappyHour(raw: unknown): HappyHourSetting {
  const v = (raw && typeof raw === 'object' ? raw : {}) as Partial<HappyHourSetting>;
  const o = v.override;
  const override =
    o &&
    typeof o === 'object' &&
    !Number.isNaN(Date.parse(o.startsAt)) &&
    !Number.isNaN(Date.parse(o.endsAt)) &&
    typeof o.multiplier === 'number'
      ? { startsAt: o.startsAt, endsAt: o.endsAt, multiplier: o.multiplier }
      : null;
  return { auto: typeof v.auto === 'boolean' ? v.auto : DEFAULTS.happyHour.auto, override };
}

const TTL_MS = 10_000;
/** at = 0 — значение устарело и будет перечитано при следующем запросе */
let cache: { at: number; value: AppSettings } = { at: 0, value: DEFAULTS };

/** Глобальные настройки из таблицы AppSetting (кеш 10 секунд). */
export async function getAppSettings(): Promise<AppSettings> {
  if (cache.at && Date.now() - cache.at < TTL_MS) return cache.value;
  const rows = await prisma.appSetting.findMany({ where: { key: { in: Object.keys(DEFAULTS) } } });
  const value: AppSettings = { ...DEFAULTS };
  for (const row of rows) {
    if (row.key === 'maintenance') value.maintenance = { ...DEFAULTS.maintenance, ...(row.value as object) };
    if (row.key === 'minClientVersion' && typeof row.value === 'string') value.minClientVersion = row.value;
    if (row.key === 'happyHour') value.happyHour = parseHappyHour(row.value);
    if (row.key === 'goldenCoin') {
      const enabled = (row.value as { enabled?: unknown } | null)?.enabled;
      value.goldenCoin = { enabled: typeof enabled === 'boolean' ? enabled : DEFAULTS.goldenCoin.enabled };
    }
  }
  cache = { at: Date.now(), value };
  return value;
}

/**
 * Последние прочитанные настройки без запроса к БД — для сборки состояния игрока.
 * Каждый запрос игрока перед этим читает настройки (хук авторизации), так что значение свежее.
 */
export function cachedAppSettings(): AppSettings {
  return cache.value;
}

export async function setAppSetting(key: keyof AppSettings, value: Prisma.InputJsonValue): Promise<void> {
  await prisma.appSetting.upsert({ where: { key }, create: { key, value }, update: { value } });
  invalidateSettingsCache();
  await getAppSettings();
}

export function invalidateSettingsCache(): void {
  cache = { at: 0, value: cache.value };
}

/** "1.2.10" >= "1.2.9" */
export function versionAtLeast(version: string, min: string): boolean {
  const a = version.split('.').map((n) => Number.parseInt(n, 10) || 0);
  const b = min.split('.').map((n) => Number.parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;
    if (x !== y) return x > y;
  }
  return true;
}
