import { Link } from 'react-router-dom';
import type { Entry } from '@/db/types';
import { formatTime, SLOT_LABEL } from '@/lib/dates';
import { carbRange, entryGi, entryTitle, fmt, giCategoryOf } from '@/lib/nutrition';
import { GiDot } from '@/ui';
import { layout as l } from '@/ui/Page';
import { Thumb } from '@/ui/Thumb';
import s from './history.module.css';

export function EntryRow({ entry, showDate }: { entry: Entry; showDate?: boolean }) {
  const gi = entryGi(entry);
  const d = new Date(entry.eatenAt);
  const estimated = entry.items.some((i) => i.confidence === 'estimate');
  const range = carbRange(entry.items);
  return (
    <li>
      <Link to={`/entry/${entry.id}`} className={s.entryRow}>
        <Thumb entry={entry} />
        <span className={l.grow}>
          <span className={`${s.entryName} ${l.truncate}`}>{entryTitle(entry)}</span>
          <span className={s.entryMeta}>
            {showDate && `${d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} · `}
            {formatTime(d)} · {SLOT_LABEL[entry.mealSlot]}
            {gi != null && (
              <>
                {' · '}
                <GiDot category={giCategoryOf(gi)} /> IG {gi}
              </>
            )}
          </span>
        </span>
        <span className={s.entryCarbs}>
          <span className="num">
            {estimated ? '~' : ''}
            {fmt(entry.totalCarbsG)} g
          </span>
          <span className={s.entryMeta}>{range ? `${fmt(range.min)}–${fmt(range.max)} g` : estimated ? 'estimation' : 'fabricant'}</span>
        </span>
      </Link>
    </li>
  );
}
