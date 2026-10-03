import type { PlayerSettings } from '@meowgul/shared';
import { useEffect, useState, type ReactNode } from 'react';
import { endpoints } from '../../api/endpoints';
import { BottomSheet } from '../../components/BottomSheet';
import { Button } from '../../components/Button';
import { Segmented } from '../../components/Segmented';
import { Toggle } from '../../components/Toggle';
import { changeSettings } from '../../game/settings';
import { tapEngine } from '../../game/tapEngine';
import { useT } from '../../i18n';
import { APP_VERSION } from '../../lib/version';
import { useCards } from '../../store/cards';
import { useCollection } from '../../store/collection';
import { useGame } from '../../store/game';
import { toast } from '../../store/toasts';
import { haptic } from '../../telegram/webapp';

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-5">
      <h2 className="mb-2 px-1 text-xs font-black uppercase tracking-wide text-white/45">{title}</h2>
      <div className="divide-y divide-white/5 overflow-hidden rounded-[20px] border border-line bg-night-700 shadow-card">
        {children}
      </div>
    </section>
  );
}

function Row({ label, hint, children }: { label: string; hint?: string; children?: ReactNode }) {
  return (
    <div className="flex min-h-[56px] items-center gap-3 px-4 py-2.5">
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-extrabold">{label}</p>
        {hint && <p className="mt-0.5 text-xs font-semibold leading-snug text-white/45">{hint}</p>}
      </div>
      {children}
    </div>
  );
}

const DELETE_WAIT_SEC = 3;

/** Настройки: язык, звук, вибрация, анимации, уведомления, удаление аккаунта. */
export function SettingsScreen() {
  const t = useT();
  const player = useGame((s) => s.player);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [wait, setWait] = useState(DELETE_WAIT_SEC);

  // кнопка удаления становится активной через 3 секунды — защита от случайного нажатия
  useEffect(() => {
    if (!deleteOpen) return;
    setWait(DELETE_WAIT_SEC);
    const id = window.setInterval(() => setWait((w) => Math.max(0, w - 1)), 1000);
    return () => window.clearInterval(id);
  }, [deleteOpen]);

  if (!player) return null;
  const s = player.profile.settings;
  const set = (patch: Partial<PlayerSettings>) => void changeSettings(patch);
  // режим разработчика меняет то, что сервер отдаёт по коллекции и карточкам — перезагрузить их
  const setDevMode = async (on: boolean) => {
    if (await changeSettings({ devMode: on })) {
      void useCollection.getState().load();
      void useCards.getState().load(true);
      toast.success(t(on ? 'settings.devMode.on' : 'settings.devMode.off'));
    }
  };

  const deleteAccount = async () => {
    setDeleting(true);
    try {
      await tapEngine.flush();
      await endpoints.deleteAccount();
      tapEngine.stop();
      haptic.notify('warning');
      setDeleteOpen(false);
      useGame.getState().setStatus('deleted');
    } catch {
      toast.error(t('action.error.generic'));
      haptic.notify('error');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto px-4 pb-8 pt-2" data-testid="settings">
      <Group title={t('settings.game')}>
        <div className="px-4 py-3">
          <p className="text-[15px] font-extrabold">{t('settings.language')}</p>
          <p className="mb-2 mt-0.5 text-xs font-semibold text-white/45">{t('settings.language.hint')}</p>
          <Segmented
            testId="settings-language"
            value={s.language ?? 'auto'}
            onChange={(v) => set({ language: v === 'auto' ? null : v })}
            options={[
              { value: 'auto', label: t('settings.language.auto') },
              { value: 'ru', label: 'Русский' },
              { value: 'en', label: 'English' },
            ]}
          />
        </div>
        <Row label={t('settings.sound')}>
          <Toggle
            label={t('settings.sound')}
            checked={s.sound}
            onChange={(v) => set({ sound: v })}
            testId="settings-sound"
          />
        </Row>
        <Row label={t('settings.vibration')}>
          <Toggle
            label={t('settings.vibration')}
            checked={s.vibration}
            onChange={(v) => set({ vibration: v })}
            testId="settings-vibration"
          />
        </Row>
        <div className="px-4 py-3">
          <p className="mb-2 text-[15px] font-extrabold">{t('settings.animations')}</p>
          <Segmented
            testId="settings-animations"
            value={s.animations}
            onChange={(v) => set({ animations: v })}
            options={[
              { value: 'full', label: t('settings.animations.full') },
              { value: 'reduced', label: t('settings.animations.reduced') },
            ]}
          />
        </div>
        <Row label={t('settings.notifications')} hint={t('settings.notifications.hint')}>
          <Toggle
            label={t('settings.notifications')}
            checked={s.notifications}
            onChange={(v) => set({ notifications: v })}
            testId="settings-notifications"
          />
        </Row>
      </Group>

      {player.profile.isAdmin && (
        <Group title="Admin">
          <a
            href="/admin"
            className="block px-4 py-4 text-[15px] font-extrabold text-gold"
            data-testid="settings-admin"
          >
            {t('settings.admin')} →
          </a>
        </Group>
      )}

      {player.profile.isDeveloper && (
        <Group title={t('settings.developer')}>
          <Row label={t('settings.devMode')} hint={t('settings.devMode.hint')}>
            <Toggle
              label={t('settings.devMode')}
              checked={s.devMode}
              onChange={(v) => void setDevMode(v)}
              testId="settings-dev-mode"
            />
          </Row>
        </Group>
      )}

      <Group title={t('settings.account')}>
        <button
          type="button"
          onClick={() => setDeleteOpen(true)}
          className="w-full px-4 py-4 text-left text-[15px] font-extrabold text-[#ff6b7a]"
          data-testid="settings-delete"
        >
          {t('settings.delete')}
        </button>
      </Group>

      <p className="mt-6 text-center text-xs font-bold text-white/30">
        Meowgul · {t('settings.version', { v: APP_VERSION })}
      </p>

      <BottomSheet open={deleteOpen} onClose={() => !deleting && setDeleteOpen(false)} testId="delete-sheet">
        <div className="flex flex-col items-center px-5 pb-6 pt-2 text-center">
          <div className="grid h-16 w-16 place-items-center rounded-full bg-[#ff5f6d]/15 text-3xl">⚠️</div>
          <h3 className="mt-3 text-xl font-black">{t('settings.delete.title')}</h3>
          <p className="mt-2 text-sm font-semibold leading-snug text-white/65">{t('settings.delete.text')}</p>
          <Button
            block
            variant="danger"
            className="mt-5"
            loading={deleting}
            disabled={wait > 0}
            onClick={() => void deleteAccount()}
            data-testid="delete-confirm"
          >
            {wait > 0 ? t('settings.delete.wait', { n: wait }) : t('settings.delete.confirm')}
          </Button>
          <Button block variant="secondary" className="mt-2" onClick={() => setDeleteOpen(false)}>
            {t('settings.delete.cancel')}
          </Button>
        </div>
      </BottomSheet>
    </div>
  );
}
