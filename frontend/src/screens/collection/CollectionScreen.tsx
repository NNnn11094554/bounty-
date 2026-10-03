import { COSMETICS, playerLevel, type CosmeticDef, type CosmeticKind } from '@meowgul/shared';
import { useEffect, useState } from 'react';
import { Button } from '../../components/Button';
import { CosmeticCard } from '../../components/cat/CosmeticCard';
import { CosmeticSheet } from '../../components/cat/CosmeticSheet';
import { Segmented } from '../../components/Segmented';
import { tapEngine } from '../../game/tapEngine';
import { useNow } from '../../hooks/useNow';
import { useT } from '../../i18n';
import { useCollection } from '../../store/collection';
import { useGame } from '../../store/game';
import { toast } from '../../store/toasts';
import { haptic } from '../../telegram/webapp';

/** Сетка предметов коллекции (скины или эффекты) с окном предмета. */
export function CosmeticGrid({ kind, testId }: { kind: CosmeticKind; testId?: string }) {
  const t = useT();
  const owned = useCollection((s) => s.owned);
  const status = useCollection((s) => s.status);
  const load = useCollection((s) => s.load);
  const equip = useCollection((s) => s.equip);
  const busy = useCollection((s) => s.busy);
  const equipped = useGame((s) => s.player?.cosmetics);
  const league = useGame((s) => s.player?.leagueLevel ?? 0);
  const [open, setOpen] = useState<CosmeticDef | null>(null);
  useNow(2000); // уровень растёт от тапов — карточки обновляются
  const level = playerLevel(tapEngine.totalEarnedNow()).level;
  // новая лига открывает скин-награду: владение считает сервер — список обновляется
  useEffect(() => {
    void load();
  }, [load, league]);
  const items = COSMETICS.filter((c) => c.kind === kind);
  const onEquip = async (id: string) => {
    const result = await equip(id);
    if (result === 'ok') {
      toast.success(t('collection.equippedToast'));
      haptic.notify('success');
    } else {
      toast.error(t('collection.error.failed'));
      haptic.notify('error');
    }
  };

  if (status === 'error' && !owned.length) {
    return (
      <div className="flex flex-col items-center gap-3 py-10 text-center" data-testid="collection-error">
        <p className="text-[15px] font-bold text-white/70">{t('collection.loadError')}</p>
        <Button variant="secondary" onClick={() => void load()} data-testid="collection-retry">
          {t('common.retry')}
        </Button>
      </div>
    );
  }
  if (!owned.length) {
    return (
      <div className="grid grid-cols-2 gap-3" aria-busy="true" data-testid="collection-loading">
        {items.slice(0, 4).map((c) => (
          <div
            key={c.id}
            className={`skeleton rounded-[20px] ${kind === 'skin' ? 'aspect-[4/5]' : 'h-[196px]'}`}
          />
        ))}
      </div>
    );
  }
  return (
    <>
      <div className="grid grid-cols-2 gap-3" data-testid={testId}>
        {items.map((item) => (
          <CosmeticCard
            key={item.id}
            item={item}
            owned={owned.includes(item.id)}
            equipped={equipped?.skin === item.id || equipped?.effect === item.id}
            level={level}
            league={league}
            onOpen={setOpen}
            onEquip={(item) => void onEquip(item.id)}
            busy={busy}
          />
        ))}
      </div>
      <CosmeticSheet item={open} onClose={() => setOpen(null)} />
    </>
  );
}

/** Коллекция: все персонажи и эффекты тапа — свои, открытые и закрытые. */
export function CollectionScreen() {
  const t = useT();
  const owned = useCollection((s) => s.owned);
  const [tab, setTab] = useState<CosmeticKind>('skin');
  useNow(2000);
  const info = playerLevel(tapEngine.totalEarnedNow());
  const ownedCount = COSMETICS.filter((c) => owned.includes(c.id)).length;
  return (
    <div className="flex h-full flex-col overflow-y-auto px-4 pb-8 pt-4" data-testid="collection">
      <div className="flex flex-col items-center gap-1 text-center">
        <h1 className="text-2xl font-black">{t('collection.title')}</h1>
        <p className="text-sm font-semibold text-white/55" data-testid="collection-subtitle">
          {t('collection.subtitle', { level: info.level, owned: ownedCount, total: COSMETICS.length })}
        </p>
        <div className="mt-1 h-1.5 w-40 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#ff4fd8] to-[#7a5cff]"
            style={{ width: `${Math.round(info.progress * 100)}%` }}
          />
        </div>
      </div>
      <div className="mb-4 mt-5">
        <Segmented
          options={[
            { value: 'skin', label: t('collection.skins') },
            { value: 'effect', label: t('collection.effects') },
          ]}
          value={tab}
          onChange={setTab}
          testId="collection-tabs"
        />
      </div>
      <CosmeticGrid kind={tab} testId="collection-grid" />
    </div>
  );
}
