import { createHash, createHmac, createPublicKey, randomBytes, timingSafeEqual, verify } from 'node:crypto';
import { Address, Cell, contractAddress, loadStateInit } from '@ton/core';
import { env } from '../env.js';

/**
 * Проверка владения кошельком TON (TON Connect ton_proof):
 *  1) сервер выдаёт подписанный payload, привязанный к игроку и живущий 15 минут;
 *  2) кошелёк подписывает сообщение с адресом, доменом приложения, временем и этим payload;
 *  3) сервер сверяет адрес с stateInit, берёт из stateInit публичный ключ и проверяет подпись ed25519.
 * Без этого любой мог бы «привязать» чужой адрес.
 */

export const PROOF_TTL_SEC = 15 * 60;
export const TON_MAINNET = '-239';
export const TON_TESTNET = '-3';

const SECRET = createHmac('sha256', 'meowgul-ton-proof').update(env.BOT_TOKEN).digest();
const ED25519_SPKI_PREFIX = Buffer.from('302a300506032b6570032100', 'hex');

function sign(userId: number, body: string): string {
  return createHmac('sha256', SECRET).update(`${userId}:${body}`).digest('hex').slice(0, 32);
}

/** payload: 24 hex случайных + 8 hex срока годности + 32 hex подписи = 64 символа. */
export function createProofPayload(
  userId: number,
  now: number = Date.now(),
): { payload: string; expiresAt: number } {
  const expires = Math.floor(now / 1000) + PROOF_TTL_SEC;
  const body = randomBytes(12).toString('hex') + expires.toString(16).padStart(8, '0');
  return { payload: body + sign(userId, body), expiresAt: expires * 1000 };
}

export function checkProofPayload(userId: number, payload: string, now: number = Date.now()): boolean {
  if (!/^[0-9a-f]{64}$/.test(payload)) return false;
  const body = payload.slice(0, 32);
  const expected = Buffer.from(sign(userId, body), 'hex');
  const actual = Buffer.from(payload.slice(32), 'hex');
  if (!timingSafeEqual(expected, actual)) return false;
  return Number.parseInt(body.slice(24), 16) * 1000 > now;
}

export interface TonProof {
  timestamp: number;
  domain: { lengthBytes: number; value: string };
  signature: string;
  payload: string;
  stateInit: string;
}

export interface WalletAccount {
  address: string;
  network: string;
  publicKey: string;
}

export type ProofFailure =
  'payload' | 'network' | 'domain' | 'expired' | 'address' | 'public_key' | 'signature' | 'malformed';

/** Домены, с которых открывается игра (из WEBAPP_URL и CORS_ORIGINS). */
export function allowedDomains(): Set<string> {
  const hosts = new Set<string>();
  for (const url of [env.WEBAPP_URL, ...env.corsOrigins]) {
    try {
      hosts.add(new URL(url).host);
    } catch {
      // не URL — пропускаем
    }
  }
  return hosts;
}

/** Публичный ключ из данных стандартного кошелька: v3/v4 — после 64 бит, v5 — после 65 бит. */
function stateInitPublicKeys(data: Cell): Buffer[] {
  const keys: Buffer[] = [];
  for (const offset of [64, 65]) {
    try {
      const s = data.beginParse();
      s.skip(offset);
      keys.push(s.loadBuffer(32));
    } catch {
      // данные короче — такого формата нет
    }
  }
  return keys;
}

function sha256(...parts: Buffer[]): Buffer {
  const h = createHash('sha256');
  for (const p of parts) h.update(p);
  return h.digest();
}

/** Проверить ton_proof. Возвращает нормализованный адрес или причину отказа. */
export function verifyTonProof(
  userId: number,
  account: WalletAccount,
  proof: TonProof,
  now: number = Date.now(),
): { ok: true; address: Address } | { ok: false; reason: ProofFailure } {
  if (!checkProofPayload(userId, proof.payload, now)) return { ok: false, reason: 'payload' };
  const networks = env.isProd ? [TON_MAINNET] : [TON_MAINNET, TON_TESTNET];
  if (!networks.includes(account.network)) return { ok: false, reason: 'network' };
  if (
    !allowedDomains().has(proof.domain.value) ||
    Buffer.byteLength(proof.domain.value) !== proof.domain.lengthBytes
  ) {
    return { ok: false, reason: 'domain' };
  }
  if (Math.abs(now / 1000 - proof.timestamp) > PROOF_TTL_SEC) return { ok: false, reason: 'expired' };

  let address: Address;
  let publicKey: Buffer;
  try {
    address = Address.parse(account.address);
    publicKey = Buffer.from(account.publicKey, 'hex');
    if (publicKey.length !== 32) return { ok: false, reason: 'public_key' };
    const init = loadStateInit(Cell.fromBase64(proof.stateInit).beginParse());
    if (!contractAddress(address.workChain, init).equals(address)) return { ok: false, reason: 'address' };
    if (!init.data || !stateInitPublicKeys(init.data).some((k) => k.equals(publicKey))) {
      return { ok: false, reason: 'public_key' };
    }
  } catch {
    return { ok: false, reason: 'malformed' };
  }

  const workchain = Buffer.alloc(4);
  workchain.writeInt32BE(address.workChain);
  const domainLength = Buffer.alloc(4);
  domainLength.writeUInt32LE(proof.domain.lengthBytes);
  const timestamp = Buffer.alloc(8);
  timestamp.writeBigUInt64LE(BigInt(proof.timestamp));
  const message = sha256(
    Buffer.from('ton-proof-item-v2/'),
    workchain,
    address.hash,
    domainLength,
    Buffer.from(proof.domain.value),
    timestamp,
    Buffer.from(proof.payload),
  );
  const digest = sha256(Buffer.from([0xff, 0xff]), Buffer.from('ton-connect'), message);
  const key = createPublicKey({
    key: Buffer.concat([ED25519_SPKI_PREFIX, publicKey]),
    format: 'der',
    type: 'spki',
  });
  let valid = false;
  try {
    valid = verify(null, digest, key, Buffer.from(proof.signature, 'base64'));
  } catch {
    valid = false;
  }
  return valid ? { ok: true, address } : { ok: false, reason: 'signature' };
}

/** Адрес для показа: user-friendly, non-bounceable (как в кошельках). */
export function friendlyAddress(raw: string): string {
  return Address.parse(raw).toString({ bounceable: false, urlSafe: true, testOnly: false });
}
