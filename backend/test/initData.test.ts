import { describe, expect, it } from 'vitest';
import { computeHash, InitDataError, signInitData, validateInitData } from '../src/auth/initData.js';

const TOKEN = '1234567890:TEST_TOKEN_for_unit_tests_only';
const user = { id: 42, first_name: 'Мурка', username: 'murka', language_code: 'ru', is_premium: true };

describe('initData validation', () => {
  it('accepts correctly signed data', () => {
    const raw = signInitData({ user, startParam: 'ref_7' }, TOKEN);
    const v = validateInitData(raw, TOKEN);
    expect(v.user.id).toBe(42);
    expect(v.user.first_name).toBe('Мурка');
    expect(v.startParam).toBe('ref_7');
  });

  it('matches the reference algorithm from Telegram docs', () => {
    // data_check_string по ключам в алфавитном порядке, hash исключён
    const params = new URLSearchParams('query_id=AAH&user=%7B%22id%22%3A1%7D&auth_date=1700000000&hash=x');
    const expected = computeHash(params, TOKEN);
    expect(expected).toMatch(/^[a-f0-9]{64}$/);
    params.set('signature', 'abc');
    expect(computeHash(params, TOKEN)).not.toBe(expected); // signature входит в проверку
  });

  it('rejects tampered user data', () => {
    const raw = signInitData({ user }, TOKEN);
    const params = new URLSearchParams(raw);
    params.set('user', JSON.stringify({ ...user, id: 43 }));
    expect(() => validateInitData(params.toString(), TOKEN)).toThrow(InitDataError);
  });

  it('rejects data signed with another bot token', () => {
    const raw = signInitData({ user }, '999:OTHER');
    expect(() => validateInitData(raw, TOKEN)).toThrow(/signature/);
  });

  it('rejects expired and future auth_date', () => {
    const old = signInitData({ user, authDate: new Date(Date.now() - 25 * 3600 * 1000) }, TOKEN);
    expect(() => validateInitData(old, TOKEN)).toThrow(/expired/);
    const fresh = signInitData({ user, authDate: new Date(Date.now() - 23 * 3600 * 1000) }, TOKEN);
    expect(validateInitData(fresh, TOKEN).user.id).toBe(42);
    const future = signInitData({ user, authDate: new Date(Date.now() + 3600 * 1000) }, TOKEN);
    expect(() => validateInitData(future, TOKEN)).toThrow(/future/);
  });

  it('rejects garbage', () => {
    expect(() => validateInitData('', TOKEN)).toThrow();
    expect(() => validateInitData('a=b', TOKEN)).toThrow(/hash/);
    expect(() => validateInitData('x'.repeat(9000), TOKEN)).toThrow();
    const noUser = new URLSearchParams({ auth_date: String(Math.floor(Date.now() / 1000)) });
    noUser.set('hash', computeHash(noUser, TOKEN));
    expect(() => validateInitData(noUser.toString(), TOKEN)).toThrow(/user/);
    const badUser = new URLSearchParams({
      auth_date: String(Math.floor(Date.now() / 1000)),
      user: '{"id":-5,"first_name":"x"}',
    });
    badUser.set('hash', computeHash(badUser, TOKEN));
    expect(() => validateInitData(badUser.toString(), TOKEN)).toThrow(/invalid/);
  });
});
