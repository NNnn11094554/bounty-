import type { Prisma } from '@prisma/client';
import { env } from '../env.js';
import { prisma } from '../lib/db.js';

export interface MaintenanceSetting {
  enabled: boolean;
  message: string;
}

interface AppSettings {
  maintenance: MaintenanceSetting;
  minClientVersion: string;
}

const DEFAULTS: AppSettings = {
  maintenance: { enabled: false, message: '' },
  minClientVersion: env.MIN_CLIENT_VERSION,
};

const TTL_MS = 10_000;
let cache: { at: number; value: AppSettings } | null = null;

/** Глобальные настройки из таблицы AppSetting (кеш 10 секунд). */
export async function getAppSettings(): Promise<AppSettings> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.value;
  const rows = await prisma.appSetting.findMany({ where: { key: { in: Object.keys(DEFAULTS) } } });
  const value: AppSettings = { ...DEFAULTS };
  for (const row of rows) {
    if (row.key === 'maintenance') value.maintenance = { ...DEFAULTS.maintenance, ...(row.value as object) };
    if (row.key === 'minClientVersion' && typeof row.value === 'string') value.minClientVersion = row.value;
  }
  cache = { at: Date.now(), value };
  return value;
}

export async function setAppSetting(key: keyof AppSettings, value: Prisma.InputJsonValue): Promise<void> {
  await prisma.appSetting.upsert({ where: { key }, create: { key, value }, update: { value } });
  cache = null;
}

export function invalidateSettingsCache(): void {
  cache = null;
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
