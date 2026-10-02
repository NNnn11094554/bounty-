import type { WalletConnectRequest } from '@meowgul/shared';
import { THEME, TonConnectUIProvider, useTonConnectUI, type Wallet } from '@tonconnect/ui-react';
import { motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { apiUrl, ApiError } from '../../api/client';
import { endpoints } from '../../api/endpoints';
import { isReducedMotion } from '../../animations';
import { Button } from '../../components/Button';
import { CardIcon } from '../../components/cards/CardIcon';
import { CoinIcon } from '../../components/icons';
import { TaskIcon } from '../../components/TaskIcon';
import { tapEngine } from '../../game/tapEngine';
import { useLocale, useT, type MessageKey } from '../../i18n';
import { MINI_APP_URL } from '../../lib/links';
import { playSound } from '../../lib/sound';
import { useGame } from '../../store/game';
import { useTasks } from '../../store/tasks';
import { toast } from '../../store/toasts';
import { haptic } from '../../telegram/webapp';
import { TaskSheet } from '../earn/TaskSheet';

const MANIFEST_URL =
  (import.meta.env.VITE_TONCONNECT_MANIFEST_URL as string | undefined) ??
  apiUrl('/api/tonconnect-manifest.json');
/** payload ton_proof живёт 15 минут — обновляем заранее */
const PAYLOAD_REFRESH_MS = 12 * 60_000;

function shortAddress(address: string): string {
  return `${address.slice(0, 4)}…${address.slice(-4)}`;
}

function connectRequest(wallet: Wallet): WalletConnectRequest | null {
  const item = wallet.connectItems?.tonProof;
  if (!item || !('proof' in item) || !wallet.account.publicKey) return null;
  return {
    address: wallet.account.address,
    network: wallet.account.chain,
    publicKey: wallet.account.publicKey,
    proof: { ...item.proof, stateInit: wallet.account.walletStateInit },
  };
}

function errorKey(err: unknown): MessageKey {
  if (err instanceof ApiError) {
    if (err.code === 'CONFLICT') return 'wallet.error.conflict';
    if (err.code === 'VALIDATION') return 'wallet.error.proof';
  }
  return 'wallet.error.unavailable';
}

/** Задание «Подключи кошелёк TON»: ton_proof проверяет сервер, адрес хранится в профиле игрока. */
function WalletCard() {
  const t = useT();
  const wallet = useGame((s) => s.player?.wallet ?? null);
  const [tonConnectUI] = useTonConnectUI();
  const [busy, setBusy] = useState(false);
  const serverWallet = useRef(wallet);
  serverWallet.current = wallet;

  // подписанный сервером payload для ton_proof — до открытия окна подключения
  useEffect(() => {
    if (wallet) return;
    let cancelled = false;
    const refresh = () => {
      tonConnectUI.setConnectRequestParameters({ state: 'loading' });
      endpoints
        .tonProofPayload()
        .then(({ payload }) => {
          if (!cancelled)
            tonConnectUI.setConnectRequestParameters({ state: 'ready', value: { tonProof: payload } });
        })
        .catch(() => {
          if (!cancelled) tonConnectUI.setConnectRequestParameters(null);
        });
    };
    refresh();
    const id = window.setInterval(refresh, PAYLOAD_REFRESH_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [wallet, tonConnectUI]);

  useEffect(
    () =>
      tonConnectUI.onStatusChange((connected) => {
        if (!connected) return;
        const request = connectRequest(connected);
        if (!request) {
          // сессия кошелька без подтверждения владения — просим подключить заново
          if (!serverWallet.current) {
            toast.error(t('wallet.error.noProof'));
            void tonConnectUI.disconnect();
          }
          return;
        }
        setBusy(true);
        endpoints
          .connectWallet(request)
          .then((res) => {
            tapEngine.applyServerState(res.state);
            void useTasks.getState().load(true);
            haptic.notify('success');
            playSound('reward');
            toast.success(t('wallet.connectedToast'));
          })
          .catch((err: unknown) => {
            toast.error(t(errorKey(err)));
            haptic.notify('error');
            void tonConnectUI.disconnect();
          })
          .finally(() => setBusy(false));
      }),
    [tonConnectUI, t],
  );

  const connect = async () => {
    haptic.impact('medium');
    if (tonConnectUI.connected) await tonConnectUI.disconnect();
    await tonConnectUI.openModal();
  };

  const disconnect = async () => {
    setBusy(true);
    try {
      const res = await endpoints.disconnectWallet();
      tapEngine.applyServerState(res.state);
      void useTasks.getState().load(true);
      if (tonConnectUI.connected) await tonConnectUI.disconnect();
      toast.info(t('wallet.disconnectedToast'));
    } catch (err) {
      toast.error(t(errorKey(err)));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-[22px] border border-line bg-night-700 p-3 shadow-card" data-testid="wallet-card">
      <div className="flex items-center gap-3">
        <CardIcon icon="wallet/none/3" size={52} />
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-extrabold leading-tight">{t('airdrop.walletTask')}</p>
          {wallet ? (
            <p
              className="mt-0.5 flex items-center gap-1 text-sm font-bold text-lime"
              data-testid="wallet-address"
            >
              ✓ {t('wallet.connected')} · <span className="font-mono">{shortAddress(wallet.address)}</span>
            </p>
          ) : (
            <p className="mt-0.5 text-xs font-bold text-white/50">{t('airdrop.walletHint')}</p>
          )}
        </div>
      </div>
      {wallet ? (
        <Button
          variant="secondary"
          block
          className="mt-3"
          loading={busy}
          onClick={() => void disconnect()}
          data-testid="wallet-disconnect"
        >
          {t('wallet.disconnect')}
        </Button>
      ) : (
        <Button
          block
          className="mt-3 h-12"
          loading={busy}
          onClick={() => void connect()}
          data-testid="wallet-connect"
        >
          {t('wallet.connect')}
        </Button>
      )}
    </div>
  );
}

function AirdropContent() {
  const t = useT();
  const locale = useLocale();
  const tasks = useTasks((s) => s.tasks);
  const load = useTasks((s) => s.load);
  const [openId, setOpenId] = useState<string | null>(null);
  useEffect(() => {
    void load();
  }, [load]);
  const extra = tasks.filter((x) => x.section === 'AIRDROP' && x.type !== 'CONNECT_WALLET');
  const openTask = openId ? (tasks.find((x) => x.id === openId) ?? null) : null;
  const reduced = isReducedMotion();

  return (
    <div className="h-full overflow-y-auto px-4 pb-6" data-testid="airdrop">
      <div className="flex flex-col items-center pt-8 text-center">
        <div className="relative">
          {!reduced && (
            <motion.div
              className="absolute inset-[-45%] rounded-full bg-[conic-gradient(from_0deg,transparent,rgba(255,201,60,0.35),transparent_30%,rgba(166,107,255,0.3),transparent_60%)]"
              animate={{ rotate: 360 }}
              transition={{ duration: 14, repeat: Infinity, ease: 'linear' }}
            />
          )}
          <motion.div
            className="relative rounded-full shadow-glow"
            animate={reduced ? undefined : { y: [0, -6, 0] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          >
            <CoinIcon size={112} />
          </motion.div>
        </div>
        <h1 className="mt-6 text-[28px] font-black">{t('airdrop.title')}</h1>
        <p className="mt-2 max-w-[320px] text-[15px] font-semibold leading-snug text-white/65">
          {t('airdrop.text')}
        </p>
      </div>

      <div className="mt-6 flex flex-col gap-2.5">
        <WalletCard />
        {extra.map((task) => (
          <motion.button
            key={task.id}
            type="button"
            whileTap={{ scale: 0.97 }}
            onClick={() => setOpenId(task.id)}
            className={`flex items-center gap-3 rounded-[20px] border border-line bg-night-700 p-3 text-left shadow-card ${task.status === 'done' ? 'opacity-70' : ''}`}
            data-testid={`airdrop-task-${task.id}`}
          >
            <TaskIcon icon={task.icon} size={48} />
            <span className="min-w-0 flex-1 truncate text-[15px] font-extrabold">{task.title[locale]}</span>
            <span className={task.status === 'done' ? 'text-lime' : 'text-white/35'}>
              {task.status === 'done' ? '✓' : '›'}
            </span>
          </motion.button>
        ))}
        {extra.length === 0 && (
          <p className="pt-2 text-center text-sm font-bold text-white/40" data-testid="airdrop-soon">
            {t('airdrop.soon')}
          </p>
        )}
      </div>
      <TaskSheet task={openTask} onClose={() => setOpenId(null)} />
    </div>
  );
}

/** Вкладка Airdrop. TON Connect загружается только здесь. */
export function AirdropScreen() {
  return (
    <TonConnectUIProvider
      manifestUrl={MANIFEST_URL}
      uiPreferences={{ theme: THEME.DARK }}
      actionsConfiguration={{ twaReturnUrl: MINI_APP_URL as `${string}://${string}` }}
    >
      <AirdropContent />
    </TonConnectUIProvider>
  );
}
