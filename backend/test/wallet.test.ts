import { createHash, generateKeyPairSync, sign, type KeyObject } from 'node:crypto';
import { beginCell, storeStateInit, type Address, type StateInit } from '@ton/core';
import { WalletContractV4, WalletContractV5R1 } from '@ton/ton';
import {
  TON_WALLET_ENABLED,
  type ApiErrorBody,
  type StateResponse,
  type TasksResponse,
  type TonProofPayloadResponse,
} from '@meowgul/shared';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/db.js';
import { checkProofPayload, createProofPayload } from '../src/services/tonProof.js';
import { seedTasks } from '../src/services/tasks.js';
import { client, createApp, resetDb, tgUser } from './helpers.js';

const DOMAIN = 'localhost:5173';

interface TestWallet {
  address: Address;
  init: StateInit;
  publicKey: Buffer;
  privateKey: KeyObject;
}

function makeWallet(version: 'v4' | 'v5' = 'v4'): TestWallet {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const raw = publicKey.export({ format: 'der', type: 'spki' }).subarray(12);
  const wallet =
    version === 'v4'
      ? WalletContractV4.create({ workchain: 0, publicKey: raw })
      : WalletContractV5R1.create({ workchain: 0, publicKey: raw });
  return { address: wallet.address, init: wallet.init, publicKey: raw, privateKey };
}

function sha256(...parts: Buffer[]): Buffer {
  const h = createHash('sha256');
  for (const p of parts) h.update(p);
  return h.digest();
}

/** Подпись ton_proof так, как это делает кошелёк. */
function proofFor(
  wallet: TestWallet,
  payload: string,
  opts: { domain?: string; timestamp?: number; signer?: KeyObject; init?: StateInit } = {},
) {
  const domain = opts.domain ?? DOMAIN;
  const timestamp = opts.timestamp ?? Math.floor(Date.now() / 1000);
  const wc = Buffer.alloc(4);
  wc.writeInt32BE(wallet.address.workChain);
  const dl = Buffer.alloc(4);
  dl.writeUInt32LE(Buffer.byteLength(domain));
  const ts = Buffer.alloc(8);
  ts.writeBigUInt64LE(BigInt(timestamp));
  const message = sha256(
    Buffer.from('ton-proof-item-v2/'),
    wc,
    wallet.address.hash,
    dl,
    Buffer.from(domain),
    ts,
    Buffer.from(payload),
  );
  const digest = sha256(Buffer.from([0xff, 0xff]), Buffer.from('ton-connect'), message);
  return {
    address: wallet.address.toRawString(),
    network: '-239',
    publicKey: wallet.publicKey.toString('hex'),
    proof: {
      timestamp,
      domain: { lengthBytes: Buffer.byteLength(domain), value: domain },
      signature: sign(null, digest, opts.signer ?? wallet.privateKey).toString('base64'),
      payload,
      stateInit: beginCell()
        .store(storeStateInit(opts.init ?? wallet.init))
        .endCell()
        .toBoc()
        .toString('base64'),
    },
  };
}

describe('TON wallet', () => {
  let app: FastifyInstance;
  beforeAll(async () => {
    app = await createApp();
  });
  afterAll(async () => {
    await app.close();
  });
  beforeEach(async () => {
    await resetDb();
    await seedTasks();
  });

  async function player(id: number) {
    const c = client(app, tgUser(id));
    await c.post('/api/auth');
    const user = await prisma.user.findUniqueOrThrow({ where: { telegramId: BigInt(id) } });
    const { payload } = (await c.get('/api/wallet/proof-payload')).json<TonProofPayloadResponse>();
    return { c, user, payload };
  }

  it('payloads are bound to the player and expire', () => {
    const { payload, expiresAt } = createProofPayload(1);
    expect(payload).toMatch(/^[0-9a-f]{64}$/);
    expect(checkProofPayload(1, payload)).toBe(true);
    expect(checkProofPayload(2, payload)).toBe(false);
    expect(checkProofPayload(1, payload, expiresAt + 1)).toBe(false);
    expect(
      checkProofPayload(
        1,
        payload.replace(/.$/, (c) => (c === '0' ? '1' : '0')),
      ),
    ).toBe(false);
  });

  it('connects a v4 wallet with a valid ton_proof and completes the wallet task', async () => {
    const wallet = makeWallet('v4');
    const { c } = await player(13001);
    const res = await c.post(
      '/api/wallet',
      proofFor(wallet, (await c.get('/api/wallet/proof-payload')).json<TonProofPayloadResponse>().payload),
    );
    expect(res.statusCode).toBe(200);
    const { state } = res.json<StateResponse>();
    expect(state.wallet?.address).toBe(wallet.address.toString({ bounceable: false, urlSafe: true }));
    const stored = await prisma.user.findUniqueOrThrow({ where: { telegramId: 13001n } });
    expect(stored.walletAddress).toBe(wallet.address.toRawString());

    const walletTask = async () =>
      (await c.get('/api/tasks')).json<TasksResponse>().tasks.find((t) => t.id === 'connect_wallet');
    if (TON_WALLET_ENABLED) expect((await walletTask())?.status).toBe('done');
    else {
      // кошелёк скрыт флагом: задания нет в списке, но сервер его отмечает
      expect(await walletTask()).toBeUndefined();
      expect(await prisma.userTask.findFirst({ where: { taskId: 'connect_wallet' } })).toMatchObject({
        status: 'DONE',
      });
    }

    // отключение — задание снова не выполнено, адрес свободен
    const off = (await c.del('/api/wallet')).json<StateResponse>();
    expect(off.state.wallet).toBeNull();
    if (TON_WALLET_ENABLED) expect((await walletTask())?.status).toBe('new');
  });

  it('accepts a v5 wallet too', async () => {
    const wallet = makeWallet('v5');
    const { c, payload } = await player(13002);
    expect((await c.post('/api/wallet', proofFor(wallet, payload))).statusCode).toBe(200);
  });

  it('rejects forged, foreign, stale and mismatching proofs', async () => {
    const wallet = makeWallet();
    const other = makeWallet();
    const { c, payload } = await player(13003);
    const { payload: foreignPayload } = await player(13004);

    const cases: Array<[string, ReturnType<typeof proofFor>]> = [
      ['payload', proofFor(wallet, foreignPayload)],
      ['domain', proofFor(wallet, payload, { domain: 'evil.example' })],
      ['expired', proofFor(wallet, payload, { timestamp: Math.floor(Date.now() / 1000) - 3600 })],
      ['signature', proofFor(wallet, payload, { signer: other.privateKey })],
      ['address', proofFor(wallet, payload, { init: other.init })],
    ];
    for (const [reason, body] of cases) {
      const res = await c.post('/api/wallet', body);
      expect(res.statusCode, reason).toBe(400);
      expect(res.json<ApiErrorBody>().error.details).toMatchObject({ reason });
    }
    const wrongKey = { ...proofFor(wallet, payload), publicKey: other.publicKey.toString('hex') };
    expect((await c.post('/api/wallet', wrongKey)).json<ApiErrorBody>().error.details).toMatchObject({
      reason: 'public_key',
    });
    const unknownNetwork = { ...proofFor(wallet, payload), network: '-1' };
    expect((await c.post('/api/wallet', unknownNetwork)).json<ApiErrorBody>().error.details).toMatchObject({
      reason: 'network',
    });
    const stored = await prisma.user.findUniqueOrThrow({ where: { telegramId: 13003n } });
    expect(stored.walletAddress).toBeNull();
  });

  it('one wallet belongs to one player', async () => {
    const wallet = makeWallet();
    const first = await player(13005);
    expect((await first.c.post('/api/wallet', proofFor(wallet, first.payload))).statusCode).toBe(200);
    const second = await player(13006);
    const res = await second.c.post('/api/wallet', proofFor(wallet, second.payload));
    expect(res.statusCode).toBe(409);
    expect(res.json<ApiErrorBody>().error.code).toBe('CONFLICT');
  });

  it('serves the TON Connect manifest without authorization', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/tonconnect-manifest.json' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ name: 'Meowgul', url: 'http://localhost:5173' });
    expect(res.json<{ iconUrl: string }>().iconUrl).toMatch(/icon-192\.png$/);
  });
});
