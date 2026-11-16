import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { Settings as SettingsIcon } from 'lucide-react';
import { useSettings } from '@/app/stores';
import { entriesBetween } from '@/db/db';
import { slotTotals, totalOf } from '@/lib/aggregate';
import { addDays, SLOT_LABEL, startOfDay } from '@/lib/dates';
import { fmt } from '@/lib/nutrition';
import { Chip, cx, ICON, Logo } from '@/ui';
import { layout as l, Page } from '@/ui/Page';
import { EntryRow } from '../history/EntryRow';
import { GlassGauge } from './GlassGauge';
import s from './today.module.css';

export function restMessage(total: number, goal: number): string {
  const rest = Math.round(goal - total);
  if (rest > 0) return `il te reste ${rest} g`;
  if (rest > -goal * 0.15) return 'objectif atteint';
  return 'grosse journée côté sucre';
}

export function Today() {
  const goal = useSettings((st) => st.settings.dailyCarbGoalG);
  const today = useMemo(() => startOfDay(new Date()), []);
  const entries = useLiveQuery(() => entriesBetween(today, addDays(today, 1)), [today]);
  const total = entries ? totalOf(entries) : 0;
  const slots = entries ? slotTotals(entries) : null;
  const dateLabel = today.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <Page
      title={<Logo size={34} />}
      action={
        <Link to="/settings" className={s.settingsLink} aria-label="Réglages">
          <SettingsIcon {...ICON} aria-hidden />
        </Link>
      }
    >
      <h1 className="sr-only">Aujourd'hui</h1>
      <section className={cx(s.hero, !goal && s.heroPlain)} aria-label="Glucides du jour">
        {goal ? <GlassGauge ratio={total / goal} label={`${fmt(total)} g de glucides sur un objectif de ${goal} g`} /> : null}
        <div className={s.figure}>
          <span className={l.eyebrow}>{dateLabel}</span>
          <span className={s.heroNum} data-testid="today-total">
            {fmt(Math.round(total))}
            <span className={s.heroUnit}>g</span>
          </span>
          {goal ? (
            <>
              <span className={s.of}>de glucides sur {goal} g</span>
              <Chip className={s.rest} tone={total >= goal ? (total > goal * 1.15 ? 'plum' : 'sage') : 'honey'}>
                {restMessage(total, goal)}
              </Chip>
            </>
          ) : (
            <>
              <span className={s.of}>de glucides aujourd'hui</span>
              <Link to="/settings" className={cx(l.small, s.rest)}>
                Fixer un objectif
              </Link>
            </>
          )}
        </div>
      </section>

      {slots && total > 0 && (
        <div className={s.slots}>
          {(['breakfast', 'lunch', 'snack', 'dinner'] as const).map((k) => (
            <div key={k} className={s.slot}>
              {SLOT_LABEL[k]}
              <span className={cx('num', s.slotNum)}>{fmt(Math.round(slots[k]))} g</span>
            </div>
          ))}
        </div>
      )}

      <div className={s.sectionHead}>
        <h2 className={l.h2}>Tes prises du jour</h2>
        {entries && entries.length > 0 && <span className={cx(l.small, l.soft)}>{entries.length} au compteur</span>}
      </div>

      {entries && entries.length === 0 ? (
        <div className={l.empty}>
          <p>Rien pour l'instant. Scanne ton premier repas avec le bouton du bas.</p>
          <Link to="/entry/new?manual=1">Ou ajoute-le à la main</Link>
        </div>
      ) : (
        <ul className={l.list}>{entries?.map((e) => <EntryRow key={e.id} entry={e} />).reverse()}</ul>
      )}
    </Page>
  );
}
